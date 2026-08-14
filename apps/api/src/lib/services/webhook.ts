import type { Clock } from "@/lib/clock";
import type { LineClient } from "@/lib/line/client";
import { isWebhookSignatureValid } from "@/lib/line/signature";
import type { ConversationStatus } from "@/lib/services/chat-types";

/**
 * T-006: LINE inbound ingest.
 *
 * D-012 — the `X-Line-Signature` HMAC is verified on every request; an invalid one is 401
 * with nothing written. Events are deduped by LINE event id.
 * D-010 — text only; any other message type is stored as a typed placeholder.
 * D-013 — the contact profile is fetched on FIRST contact only, and a profile failure must
 * not block storing the message.
 * D-047 — a conversation is created `Open`; inbound on a `Closed` one reopens it `Pending`.
 */

export interface WebhookStore {
  /**
   * D-012's dedupe. Returns `false` when this event id has already been recorded.
   * Backed by the unique constraint on `webhook_events.lineEventId`, so a redelivery loses
   * the insert race rather than being filtered by a prior read.
   */
  recordEvent(lineEventId: string): Promise<boolean>;

  findContactByLineUserId(lineUserId: string): Promise<{ id: string } | null>;

  createContact(args: {
    lineUserId: string;
    displayName: string;
    avatarUrl: string | null;
    firstSeenAt: Date;
  }): Promise<{ id: string }>;

  /** D-048: a contact may hold several; this is the one an inbound message lands on. */
  latestConversationForContact(
    contactId: string,
  ): Promise<{ id: string; status: ConversationStatus } | null>;

  createConversation(args: {
    contactId: string;
    at: Date;
  }): Promise<{ id: string }>;

  /**
   * Records the inbound message and moves the conversation with it: `lastMessageAt`,
   * `unread`, and D-047's reopen. One call, because these must not diverge — a message
   * stored without its conversation being marked unread is an invisible message.
   */
  appendInboundMessage(args: {
    conversationId: string;
    messageType: string;
    text: string | null;
    at: Date;
    /** D-047: set to `Pending` on reopen, left alone otherwise. */
    reopenAsPending: boolean;
  }): Promise<void>;

  /** D-006: kept so the send path can prefer Reply over Push. */
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
  /** The EXACT bytes LINE sent. Re-serialising would break the HMAC. */
  readonly rawBody: string;
  readonly signature: string | null;
}

export async function ingestWebhook(
  input: WebhookInput,
  dependencies: WebhookDependencies,
): Promise<WebhookOutcome> {
  // D-012: signature first, before parsing. An unsigned body is never even read as JSON.
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
    // Errors are deliberately NOT caught per event. A store failure propagates to a 500,
    // LINE retries, and the dedupe above makes the retry safe. Swallowing it would return
    // 200 and lose the message permanently, which is the worse failure.
    if (await ingestEvent(event, dependencies)) {
      stored += 1;
    } else {
      skipped += 1;
    }
  }

  return { outcome: "accepted", stored, skipped };
}

/** @returns whether a message was stored. */
async function ingestEvent(
  event: LineEvent,
  dependencies: WebhookDependencies,
): Promise<boolean> {
  const { store, line, clock } = dependencies;

  // D-012: dedupe before any write. A redelivered event must produce no second row.
  if (!(await store.recordEvent(event.id))) {
    return false;
  }

  const now = clock.now();

  let contact = await store.findContactByLineUserId(event.lineUserId);

  if (!contact) {
    // D-013: the profile is fetched ONLY on first contact. A known contact never triggers
    // a call — asserted as a test, because it is a per-message cost if it regresses.
    const profile = await line.fetchProfile(event.lineUserId);

    contact = await store.createContact({
      lineUserId: event.lineUserId,
      // D-013's recorded fallback: the LINE user id when the profile fetch failed.
      displayName: profile?.displayName ?? event.lineUserId,
      avatarUrl: profile?.avatarUrl ?? null,
      firstSeenAt: now,
    });
  }

  const existing = await store.latestConversationForContact(contact.id);

  // D-047: created `Open`; an inbound message on a `Closed` conversation reopens THAT
  // conversation as `Pending` rather than starting a new thread (D-048).
  const conversation =
    existing ??
    (await store.createConversation({ contactId: contact.id, at: now }));

  await store.appendInboundMessage({
    conversationId: conversation.id,
    // D-010: `text` is the only supported type; anything else keeps its LINE type and
    // stores no text, which is what the console renders as an unsupported placeholder.
    messageType: event.messageType,
    text: event.messageType === "text" ? event.text : null,
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

interface LineEvent {
  id: string;
  lineUserId: string;
  messageType: string;
  text: string | null;
  replyToken: string | null;
}

/**
 * @returns the message events worth storing, or `null` when the payload is not a LINE
 * webhook body at all.
 *
 * An individual event that is not an inbound user message — a follow, a postback, a group
 * source with no user id — is DROPPED rather than treated as malformed. LINE sends those
 * legitimately, and 400-ing the batch would make it retry a payload that will never
 * succeed.
 */
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
    // Without an event id there is no dedupe key, and D-012 makes dedupe mandatory.
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

  const { type, text } = message as Record<string, unknown>;

  if (typeof type !== "string" || type.length === 0) {
    return null;
  }

  return {
    id,
    lineUserId,
    messageType: type,
    text: typeof text === "string" ? text : null,
    replyToken:
      typeof event.replyToken === "string" && event.replyToken.length > 0
        ? event.replyToken
        : null,
  };
}
