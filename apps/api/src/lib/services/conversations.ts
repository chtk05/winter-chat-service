import {
  isConversationStatus,
  toConversationSummaryDto,
  type ConversationDto,
  type ConversationRow,
  type ConversationStatus,
  type ConversationSummaryDto,
} from "@/lib/services/chat-types";

/**
 * T-013: the conversation list, detail, status change and read marker.
 *
 * D-048 is the load-bearing decision here: the schema permits a contact to hold several
 * conversations, but the list returns ONE ROW PER CONTACT — that contact's most recent
 * conversation. The query is written that way from the start so it stays correct if a
 * second conversation ever appears; today it is D-047 that keeps there being only one.
 */
export const CONVERSATION_PAGE_LIMIT = 30;

/** A conversation row plus the snippet the list renders under the contact's name. */
export interface ConversationListRow {
  conversation: ConversationRow;
  /** Text of the most recent message; absent when the conversation has none. */
  snippet?: string;
}

export interface ConversationTotals {
  matching: number;
  all: number;
  open: number;
}

export interface ConversationStore {
  /**
   * The latest conversation per contact (D-048), most recent first, filtered by `status`
   * and `search` when given. Returns at most `take` rows, starting after `cursor`.
   */
  listLatestPerContact(args: {
    status?: ConversationStatus;
    search?: string;
    cursor?: string;
    take: number;
  }): Promise<ConversationListRow[]>;

  /** D-048: these count CONTACTS, consistently with D-027's unread unit. */
  countTotals(args: {
    status?: ConversationStatus;
    search?: string;
  }): Promise<ConversationTotals>;

  findById(conversationId: string): Promise<ConversationRow | null>;
  countMessages(conversationId: string): Promise<number>;
  latestSnippet(conversationId: string): Promise<string | undefined>;
  updateStatus(
    conversationId: string,
    status: ConversationStatus,
  ): Promise<ConversationRow | null>;
  markRead(conversationId: string): Promise<boolean>;
}

export interface ConversationListDto {
  items: ConversationSummaryDto[];
  nextCursor: string | null;
  totals: ConversationTotals;
}

export interface ConversationListQuery {
  readonly status?: string | null;
  readonly search?: string | null;
  readonly cursor?: string | null;
}

export type ConversationListResult =
  | { readonly outcome: "ok"; readonly list: ConversationListDto }
  | { readonly outcome: "invalid-status" };

export async function listConversations(
  query: ConversationListQuery,
  store: ConversationStore,
): Promise<ConversationListResult> {
  const status = parseStatusFilter(query.status);

  if (status === "invalid") {
    return { outcome: "invalid-status" };
  }

  // `openapi.yaml`: "Empty string is treated as absent." Whitespace-only likewise — the
  // frontend already trims (T-017), and the contract must hold regardless of client.
  const search = query.search?.trim() ? query.search.trim() : undefined;

  const filters = { status, search };

  const rows = await store.listLatestPerContact({
    ...filters,
    cursor: query.cursor ?? undefined,
    take: CONVERSATION_PAGE_LIMIT + 1,
  });

  const hasMore = rows.length > CONVERSATION_PAGE_LIMIT;
  const page = hasMore ? rows.slice(0, CONVERSATION_PAGE_LIMIT) : rows;

  // Totals describe the whole filtered set, not this page — the design's footer line
  // reads "1 of 4 conversations · 2 open", so `matching` must not be `page.length`.
  const totals = await store.countTotals(filters);

  return {
    outcome: "ok",
    list: {
      items: page.map((row) =>
        toConversationSummaryDto(row.conversation, row.snippet),
      ),
      nextCursor: hasMore
        ? (page[page.length - 1]?.conversation.id ?? null)
        : null,
      totals,
    },
  };
}

export type ConversationResult =
  | { readonly outcome: "ok"; readonly conversation: ConversationDto }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "invalid-status" };

export async function getConversation(
  conversationId: string,
  store: ConversationStore,
): Promise<ConversationResult> {
  const conversation = await store.findById(conversationId);

  if (!conversation) {
    return { outcome: "not-found" };
  }

  return {
    outcome: "ok",
    conversation: await withDetail(conversation, store),
  };
}

/**
 * D-019: status is the only mutable field. D-047's two automatic transitions
 * (create-as-`Open`, reopen-`Closed`-as-`Pending`) belong to the inbound path, not here —
 * this is the admin acting explicitly.
 */
export async function setConversationStatus(
  conversationId: string,
  requestedStatus: unknown,
  store: ConversationStore,
): Promise<ConversationResult> {
  if (!isConversationStatus(requestedStatus)) {
    return { outcome: "invalid-status" };
  }

  const updated = await store.updateStatus(conversationId, requestedStatus);

  if (!updated) {
    return { outcome: "not-found" };
  }

  return { outcome: "ok", conversation: await withDetail(updated, store) };
}

export type MarkReadResult = "ok" | "not-found";

/**
 * D-007: opening a thread marks it read. D-027 makes read state a single per-conversation
 * boolean rather than a per-message flag, so this is one write, and idempotent.
 */
export async function markConversationRead(
  conversationId: string,
  store: ConversationStore,
): Promise<MarkReadResult> {
  return (await store.markRead(conversationId)) ? "ok" : "not-found";
}

async function withDetail(
  conversation: ConversationRow,
  store: ConversationStore,
): Promise<ConversationDto> {
  const [messageCount, snippet] = await Promise.all([
    store.countMessages(conversation.id),
    store.latestSnippet(conversation.id),
  ]);

  return {
    ...toConversationSummaryDto(conversation, snippet),
    messageCount,
  };
}

function parseStatusFilter(
  raw: string | null | undefined,
): ConversationStatus | undefined | "invalid" {
  if (raw === undefined || raw === null || raw === "") {
    // `openapi.yaml`: omit for the All filter.
    return undefined;
  }

  return isConversationStatus(raw) ? raw : "invalid";
}
