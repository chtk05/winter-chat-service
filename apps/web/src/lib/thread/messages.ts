import type { Message } from "@/lib/api/types";

/**
 * Pure message-list operations shared by the composer's optimistic send (T-018)
 * and the Supabase Realtime reducer (T-009).
 *
 * Keeping them pure and free of React is what lets D-005's requirement — that
 * realtime *delivery* is integration-level while the reducer logic is unit
 * tested over synthetic payloads — actually be met.
 */

/** D-021: `clientId` is both the optimistic-bubble key and the idempotency key. */
export function keyOf(message: Message): string {
  return message.clientId ?? message.id;
}

/** The optimistic bubble the composer renders before the server answers (D-013). */
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

function sortByCreatedAt(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/**
 * Insert or replace a message.
 *
 * Matching is by `clientId` first so a server row reconciles the optimistic
 * bubble **in place** rather than appearing beside it, then by `id` so a
 * redelivered realtime payload updates rather than duplicates.
 */
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
  // Preserve the optimistic createdAt so a reconciled bubble does not jump.
  next[index] = { ...next[index], ...incoming };
  return sortByCreatedAt(next);
}

/** Merge an older page from "Load full history" without duplicating or reordering. */
export function mergeOlderPage(
  messages: Message[],
  older: Message[],
): Message[] {
  const seen = new Set(messages.map((message) => message.id));
  const additions = older.filter((message) => !seen.has(message.id));
  return sortByCreatedAt([...additions, ...messages]);
}

/** Mark an optimistic bubble failed when the send never reached the server. */
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

/* ------------------------------------------------- T-009: realtime input --- */

/** The shape of a Supabase Postgres change event, narrowed to what is consumed. */
export interface RealtimeChange {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: unknown;
  old?: unknown;
}

/** Structural check — a payload from the network is never trusted to be a Message. */
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

/**
 * Apply one Realtime change to the loaded thread.
 *
 * Negative cases required by T-009 are all handled by returning the list
 * unchanged rather than throwing: a malformed payload is dropped, a payload for
 * a conversation that is not open is ignored, and a duplicate is an upsert.
 */
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
