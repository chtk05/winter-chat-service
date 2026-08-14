import type { Clock } from "@/lib/clock";
import type { LineClient } from "@/lib/line/client";
import { isWebhookSignatureValid } from "@/lib/line/signature";
import type { ConversationStatus } from "@/lib/services/chat-types";
import type { StorageClient } from "@/lib/storage/client";
import { CHAT_MEDIA_BUCKET, extensionForMimeType } from "@/lib/storage/bucket";

export interface WebhookStore {
  recordEvent(lineEventId: string): Promise<boolean>;

  findContactByLineUserId(lineUserId: string): Promise<{ id: string } | null>;

  createContact(args: {
    lineUserId: string;
    displayName: string;
    avatarUrl: string | null;
    firstSeenAt: Date;
  }): Promise<{ id: string }>;

  latestConversationForContact(
    contactId: string,
  ): Promise<{ id: string; status: ConversationStatus } | null>;

  createConversation(args: {
    contactId: string;
    at: Date;
  }): Promise<{ id: string }>;

  appendInboundMessage(args: {
    conversationId: string;
    messageType: string;
    text: string | null;
    mediaUrl: string | null;
    at: Date;
    reopenAsPending: boolean;
  }): Promise<void>;

  saveReplyToken(args: {
    conversationId: string;
    value: string;
    issuedAt: Date;
  }): Promise<void>;
}

export interface WebhookDependencies {
  readonly channelSecret: string;
  readonly store: WebhookStore;
  readonly line: LineClient;
  readonly clock: Clock;
  readonly storage: StorageClient;
}

export type WebhookOutcome =
  | {
      readonly outcome: "accepted";
      readonly stored: number;
      readonly skipped: number;
    }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "malformed" };

export interface WebhookInput {
  readonly rawBody: string;
  readonly signature: string | null;
}

export async function ingestWebhook(
  input: WebhookInput,
  dependencies: WebhookDependencies,
): Promise<WebhookOutcome> {
  if (
    !isWebhookSignatureValid(
      input.rawBody,
      input.signature,
      dependencies.channelSecret,
    )
  ) {
    console.warn("[webhook] rejected: invalid or missing X-Line-Signature");
    return { outcome: "unauthorized" };
  }

  const events = readEvents(input.rawBody);

  if (events === null) {
    return { outcome: "malformed" };
  }

  let stored = 0;
  let skipped = 0;

  for (const event of events) {
    if (await ingestEvent(event, dependencies)) {
      stored += 1;
    } else {
      skipped += 1;
    }
  }

  return { outcome: "accepted", stored, skipped };
}

async function ingestEvent(
  event: LineEvent,
  dependencies: WebhookDependencies,
): Promise<boolean> {
  const { store, line, clock, storage } = dependencies;

  if (!(await store.recordEvent(event.id))) {
    return false;
  }

  const now = clock.now();

  let contact = await store.findContactByLineUserId(event.lineUserId);

  if (!contact) {
    const profile = await line.fetchProfile(event.lineUserId);

    contact = await store.createContact({
      lineUserId: event.lineUserId,
      displayName: profile?.displayName ?? event.lineUserId,
      avatarUrl: profile?.avatarUrl ?? null,
      firstSeenAt: now,
    });
  }

  const existing = await store.latestConversationForContact(contact.id);

  const conversation =
    existing ??
    (await store.createConversation({ contactId: contact.id, at: now }));

  const mediaUrl =
    event.messageType === "image" && event.lineMessageId
      ? await downloadAndRehost(event.lineMessageId, line, storage)
      : event.messageType === "sticker" && event.stickerId
        ? stickerImageUrl(event.stickerId)
        : null;

  await store.appendInboundMessage({
    conversationId: conversation.id,
    messageType: event.messageType,
    text: event.messageType === "text" ? event.text : null,
    mediaUrl,
    at: now,
    reopenAsPending: existing?.status === "Closed",
  });

  if (event.replyToken) {
    await store.saveReplyToken({
      conversationId: conversation.id,
      value: event.replyToken,
      issuedAt: now,
    });
  }

  return true;
}

async function downloadAndRehost(
  lineMessageId: string,
  line: LineClient,
  storage: StorageClient,
): Promise<string | null> {
  const content = await line.fetchContent(lineMessageId);
  if (!content) {
    return null;
  }

  const extension = extensionForMimeType(content.contentType) ?? "jpg";

  const uploaded = await storage.upload({
    bucket: CHAT_MEDIA_BUCKET,
    path: `inbound/${lineMessageId}.${extension}`,
    bytes: content.bytes,
    contentType: content.contentType,
  });

  return uploaded?.url ?? null;
}

/**
 * Unlike a photo, a LINE sticker's image is already hosted on LINE's own public
 * CDN — no Content API round trip and no re-hosting needed, just this URL
 * pattern, keyed by `stickerId` alone. This is LINE's own widely-documented
 * sticker resource convention (not something this repo can verify against a
 * vendored doc the way D-033 verifies Next.js behavior); a sticker whose id
 * doesn't resolve to a real image degrades to the same "Image unavailable"
 * state a failed photo re-host already has, via the `<img>`'s `onError`.
 */
function stickerImageUrl(stickerId: string): string {
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`;
}

interface LineEvent {
  id: string;
  lineUserId: string;
  messageType: string;
  text: string | null;
  lineMessageId: string | null;
  replyToken: string | null;
  stickerId: string | null;
}

function readEvents(rawBody: string): LineEvent[] | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const { events } = parsed as Record<string, unknown>;

  if (!Array.isArray(events)) {
    return null;
  }

  return events
    .map(readEvent)
    .filter((event): event is LineEvent => event !== null);
}

function readEvent(raw: unknown): LineEvent | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const event = raw as Record<string, unknown>;

  if (event.type !== "message") {
    return null;
  }

  const id = event.webhookEventId;
  const source = event.source;
  const message = event.message;

  if (typeof id !== "string" || id.length === 0) {
    return null;
  }

  if (typeof source !== "object" || source === null) {
    return null;
  }

  const lineUserId = (source as Record<string, unknown>).userId;

  if (typeof lineUserId !== "string" || lineUserId.length === 0) {
    return null;
  }

  if (typeof message !== "object" || message === null) {
    return null;
  }

  const {
    id: messageId,
    type,
    text,
    stickerId,
  } = message as Record<string, unknown>;

  if (typeof type !== "string" || type.length === 0) {
    return null;
  }

  return {
    id,
    lineUserId,
    messageType: type,
    text: typeof text === "string" ? text : null,
    lineMessageId: typeof messageId === "string" ? messageId : null,
    replyToken:
      typeof event.replyToken === "string" && event.replyToken.length > 0
        ? event.replyToken
        : null,
    stickerId: typeof stickerId === "string" ? stickerId : null,
  };
}
