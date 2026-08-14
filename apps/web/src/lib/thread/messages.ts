import type { Message } from "@/lib/api/types";

export function keyOf(message: Message): string {
  return message.clientId ?? message.id;
}

export function optimisticMessage({
  conversationId,
  text,
  clientId,
  now,
}: {
  conversationId: string;
  text: string;
  clientId: string;
  now: Date;
}): Message {
  return {
    id: clientId,
    conversationId,
    clientId,
    direction: "outbound",
    messageType: "text",
    text,
    deliveryStatus: "sending",
    createdAt: now.toISOString(),
  };
}

export function optimisticImageMessage({
  conversationId,
  previewUrl,
  clientId,
  now,
}: {
  conversationId: string;
  previewUrl: string;
  clientId: string;
  now: Date;
}): Message {
  return {
    id: clientId,
    conversationId,
    clientId,
    direction: "outbound",
    messageType: "image",
    mediaUrl: previewUrl,
    deliveryStatus: "sending",
    createdAt: now.toISOString(),
  };
}

function sortByCreatedAt(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function upsertMessage(
  messages: Message[],
  incoming: Message,
): Message[] {
  const index = messages.findIndex(
    (existing) =>
      (incoming.clientId != null && existing.clientId === incoming.clientId) ||
      existing.id === incoming.id,
  );

  if (index === -1) {
    return sortByCreatedAt([...messages, incoming]);
  }

  const next = [...messages];
  next[index] = { ...next[index], ...incoming };
  return sortByCreatedAt(next);
}

export function mergeOlderPage(
  messages: Message[],
  older: Message[],
): Message[] {
  const seen = new Set(messages.map((message) => message.id));
  const additions = older.filter((message) => !seen.has(message.id));
  return sortByCreatedAt([...additions, ...messages]);
}

export function markFailed(
  messages: Message[],
  clientId: string,
  failureReason: string,
): Message[] {
  return messages.map((message) =>
    message.clientId === clientId
      ? { ...message, deliveryStatus: "failed" as const, failureReason }
      : message,
  );
}

export interface RealtimeChange {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: unknown;
  old?: unknown;
}

export function isMessagePayload(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.conversationId === "string" &&
    (candidate.direction === "inbound" || candidate.direction === "outbound") &&
    typeof candidate.messageType === "string" &&
    typeof candidate.createdAt === "string"
  );
}

export function applyRealtimeChange(
  messages: Message[],
  change: RealtimeChange,
  openConversationId: string | null,
): Message[] {
  if (change.eventType === "DELETE") return messages;
  if (!isMessagePayload(change.new)) return messages;

  const incoming = change.new;
  if (
    openConversationId === null ||
    incoming.conversationId !== openConversationId
  ) {
    return messages;
  }

  return upsertMessage(messages, incoming);
}
