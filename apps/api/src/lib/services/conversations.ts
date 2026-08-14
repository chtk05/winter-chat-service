import {
  isConversationStatus,
  toConversationSummaryDto,
  type ConversationDto,
  type ConversationRow,
  type ConversationStatus,
  type ConversationSummaryDto,
} from "@/lib/services/chat-types";

export const CONVERSATION_PAGE_LIMIT = 30;

export interface ConversationListRow {
  conversation: ConversationRow;
  snippet?: string;
}

export interface ConversationTotals {
  matching: number;
  all: number;
  open: number;
}

export interface ConversationStore {
  listLatestPerContact(args: {
    status?: ConversationStatus;
    search?: string;
    cursor?: string;
    take: number;
  }): Promise<ConversationListRow[]>;

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

  const search = query.search?.trim() ? query.search.trim() : undefined;

  const filters = { status, search };

  const rows = await store.listLatestPerContact({
    ...filters,
    cursor: query.cursor ?? undefined,
    take: CONVERSATION_PAGE_LIMIT + 1,
  });

  const hasMore = rows.length > CONVERSATION_PAGE_LIMIT;
  const page = hasMore ? rows.slice(0, CONVERSATION_PAGE_LIMIT) : rows;

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
    return undefined;
  }

  return isConversationStatus(raw) ? raw : "invalid";
}
