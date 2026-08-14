import type { Clock } from "@/lib/clock";
import type { LineClient } from "@/lib/line/client";
import {
  toMessageDto,
  type DeliveryStatus,
  type MessageDto,
  type MessageRow,
  type SentVia,
} from "@/lib/services/chat-types";

export const MAX_TEXT_LENGTH = 5000;

export interface SendStore {
  findConversationForSend(
    conversationId: string,
  ): Promise<{ id: string; contactLineUserId: string } | null>;

  findMessageByClientId(clientId: string): Promise<MessageRow | null>;

  createSendingMessage(args: {
    conversationId: string;
    clientId: string;
    messageType: "text" | "image";
    text: string | null;
    mediaUrl: string | null;
    createdAt: Date;
  }): Promise<MessageRow>;

  findUnusedReplyToken(
    conversationId: string,
  ): Promise<{ value: string } | null>;

  markReplyTokenUsed(value: string): Promise<void>;

  resolveMessage(args: {
    id: string;
    deliveryStatus: DeliveryStatus;
    sentVia: SentVia | null;
    failureReason: string | null;
  }): Promise<MessageRow>;

  closeConversation(conversationId: string): Promise<void>;

  findMessageById(id: string): Promise<MessageRow | null>;

  markMessageSending(id: string): Promise<MessageRow>;
}

export interface SendDependencies {
  readonly store: SendStore;
  readonly line: LineClient;
  readonly clock: Clock;
}

export type SendResult =
  | { readonly outcome: "ok"; readonly message: MessageDto }
  | { readonly outcome: "invalid-text" }
  | { readonly outcome: "invalid-media-url" }
  | { readonly outcome: "missing-client-id" }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "not-retryable" };

export interface SendInput {
  readonly conversationId: string;
  readonly text: unknown;
  readonly mediaUrl?: unknown;
  readonly clientId: unknown;
  readonly closeAfterSend: unknown;
}

export async function sendMessage(
  input: SendInput,
  deps: SendDependencies,
): Promise<SendResult> {
  const clientId = input.clientId;
  if (typeof clientId !== "string" || clientId.length === 0) {
    return { outcome: "missing-client-id" };
  }

  const mediaUrl =
    typeof input.mediaUrl === "string" && input.mediaUrl.trim().length > 0
      ? input.mediaUrl.trim()
      : null;

  let text: string | null = null;
  let messageType: "text" | "image";

  if (mediaUrl) {
    if (!/^https:\/\//.test(mediaUrl)) {
      return { outcome: "invalid-media-url" };
    }
    messageType = "image";
  } else {
    const trimmed = typeof input.text === "string" ? input.text.trim() : "";
    if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LENGTH) {
      return { outcome: "invalid-text" };
    }
    text = trimmed;
    messageType = "text";
  }

  const closeAfterSend = input.closeAfterSend === true;

  const conversation = await deps.store.findConversationForSend(
    input.conversationId,
  );
  if (!conversation) {
    return { outcome: "not-found" };
  }

  const existing = await deps.store.findMessageByClientId(clientId);
  if (existing) {
    return { outcome: "ok", message: toMessageDto(existing) };
  }

  const now = deps.clock.now();

  const sending = await deps.store.createSendingMessage({
    conversationId: conversation.id,
    clientId,
    messageType,
    text,
    mediaUrl,
    createdAt: now,
  });

  if (sending.clientId !== clientId || sending.deliveryStatus !== "sending") {
    return { outcome: "ok", message: toMessageDto(sending) };
  }

  const resolved = await attemptDelivery(
    sending,
    conversation.contactLineUserId,
    deps,
  );

  if (closeAfterSend && resolved.deliveryStatus === "sent") {
    await deps.store.closeConversation(conversation.id);
  }

  return { outcome: "ok", message: toMessageDto(resolved) };
}

export async function retryMessage(
  messageId: string,
  deps: SendDependencies,
): Promise<SendResult> {
  const message = await deps.store.findMessageById(messageId);

  if (!message) {
    return { outcome: "not-found" };
  }

  if (message.direction !== "outbound" || message.deliveryStatus !== "failed") {
    return { outcome: "not-retryable" };
  }

  const conversation = await deps.store.findConversationForSend(
    message.conversationId,
  );
  if (!conversation) {
    return { outcome: "not-found" };
  }

  const sending = await deps.store.markMessageSending(messageId);
  const resolved = await attemptDelivery(
    sending,
    conversation.contactLineUserId,
    deps,
  );

  return { outcome: "ok", message: toMessageDto(resolved) };
}

async function attemptDelivery(
  message: MessageRow,
  contactLineUserId: string,
  deps: SendDependencies,
): Promise<MessageRow> {
  const token = await deps.store.findUnusedReplyToken(message.conversationId);

  const isImage = message.messageType === "image";
  const content = isImage ? (message.mediaUrl ?? "") : (message.text ?? "");
  const reply = isImage
    ? (t: string) => deps.line.replyImage(t, content)
    : (t: string) => deps.line.replyMessage(t, content);
  const push = isImage
    ? () => deps.line.pushImage(contactLineUserId, content)
    : () => deps.line.pushMessage(contactLineUserId, content);

  let sentVia: SentVia;
  let delivered: boolean;

  if (token) {
    delivered = await reply(token.value);
    await deps.store.markReplyTokenUsed(token.value);

    if (delivered) {
      sentVia = "reply";
    } else {
      sentVia = "push";
      delivered = await push();
    }
  } else {
    sentVia = "push";
    delivered = await push();
  }

  return deps.store.resolveMessage({
    id: message.id,
    deliveryStatus: delivered ? "sent" : "failed",
    sentVia: delivered ? sentVia : null,
    failureReason: delivered ? null : "LINE did not accept the message.",
  });
}
