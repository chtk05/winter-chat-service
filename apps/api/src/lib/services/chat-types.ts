export type ConversationStatus = "Open" | "Pending" | "Closed";
export type MessageDirection = "inbound" | "outbound";
export type DeliveryStatus = "sending" | "sent" | "failed";
export type SentVia = "reply" | "push";

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  "Open",
  "Pending",
  "Closed",
];

export function isConversationStatus(
  value: unknown,
): value is ConversationStatus {
  return (
    typeof value === "string" &&
    (CONVERSATION_STATUSES as readonly string[]).includes(value)
  );
}

export interface ContactRow {
  id: string;
  lineUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  firstSeenAt: Date;
}

export interface ConversationRow {
  id: string;
  status: ConversationStatus;
  unread: boolean;
  lastMessageAt: Date;
  contact: ContactRow;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  clientId: string | null;
  direction: MessageDirection;
  messageType: string;
  text: string | null;
  mediaUrl: string | null;
  deliveryStatus: DeliveryStatus | null;
  failureReason: string | null;
  sentVia: SentVia | null;
  createdAt: Date;
}

export interface ContactDto {
  id: string;
  lineUserId: string;
  displayName: string;
  avatarUrl: string | null;
  firstSeenAt: string;
}

export interface ConversationSummaryDto {
  id: string;
  contact: ContactDto;
  status: ConversationStatus;
  unread: boolean;
  snippet?: string;
  lastMessageAt: string;
  channel: "LINE";
}

export interface ConversationDto extends ConversationSummaryDto {
  messageCount: number;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  clientId: string | null;
  direction: MessageDirection;
  messageType: string;
  text: string | null;
  mediaUrl: string | null;
  deliveryStatus: DeliveryStatus | null;
  failureReason: string | null;
  sentVia: SentVia | null;
  createdAt: string;
}

export function toContactDto(contact: ContactRow): ContactDto {
  return {
    id: contact.id,
    lineUserId: contact.lineUserId,
    displayName: contact.displayName ?? contact.lineUserId,
    avatarUrl: contact.avatarUrl,
    firstSeenAt: contact.firstSeenAt.toISOString(),
  };
}

export function toConversationSummaryDto(
  conversation: ConversationRow,
  snippet?: string,
): ConversationSummaryDto {
  return {
    id: conversation.id,
    contact: toContactDto(conversation.contact),
    status: conversation.status,
    unread: conversation.unread,
    ...(snippet === undefined ? {} : { snippet }),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    channel: "LINE",
  };
}

export function toMessageDto(message: MessageRow): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    clientId: message.clientId,
    direction: message.direction,
    messageType: message.messageType,
    text: message.text,
    mediaUrl: message.mediaUrl,
    deliveryStatus: message.deliveryStatus,
    failureReason: message.failureReason,
    sentVia: message.sentVia,
    createdAt: message.createdAt.toISOString(),
  };
}
