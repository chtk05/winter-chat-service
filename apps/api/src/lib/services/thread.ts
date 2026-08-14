import {
  toMessageDto,
  type MessageDto,
  type MessageRow,
} from "@/lib/services/chat-types";

/**
 * T-014: thread history, newest last, paged backwards behind the design's "Load full
 * history" control.
 *
 * D-026 fixes the sizes: 30 on the initial load, 50 per page, and a `limit` above 50 is
 * REJECTED rather than silently clamped. Clamping would let the client believe it had
 * asked for more than it received, which is exactly the bug the "no overlap or gap"
 * requirement is about.
 */
export const INITIAL_MESSAGE_LIMIT = 30;
export const MAX_MESSAGE_LIMIT = 50;

export interface ThreadStore {
  conversationExists(conversationId: string): Promise<boolean>;
  /**
   * Messages for the conversation, NEWEST FIRST, starting strictly older than `before`
   * when given. Returns at most `take` rows.
   */
  listMessagesDescending(args: {
    conversationId: string;
    before?: string;
    take: number;
  }): Promise<MessageRow[]>;
}

export interface ThreadPageDto {
  items: MessageDto[];
  hasMore: boolean;
  nextCursor: string | null;
}

export type ThreadPageResult =
  | { readonly outcome: "ok"; readonly page: ThreadPageDto }
  | { readonly outcome: "invalid-limit" }
  | { readonly outcome: "not-found" };

export interface ThreadQuery {
  readonly conversationId: string;
  /** Raw query-string values: unvalidated by definition. */
  readonly before?: string | null;
  readonly limit?: string | null;
}

export async function listThreadMessages(
  query: ThreadQuery,
  store: ThreadStore,
): Promise<ThreadPageResult> {
  const limit = parseLimit(query.limit);

  if (limit === null) {
    return { outcome: "invalid-limit" };
  }

  if (!(await store.conversationExists(query.conversationId))) {
    return { outcome: "not-found" };
  }

  // One more than asked for, so "is there another page?" is answered by the read itself
  // rather than by a second count query that could disagree with it.
  const rows = await store.listMessagesDescending({
    conversationId: query.conversationId,
    before: query.before ?? undefined,
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    outcome: "ok",
    page: {
      // The store reads newest-first for the cursor to work; the contract renders
      // newest-LAST. Reversed here, once, rather than in every caller.
      items: page.map(toMessageDto).reverse(),
      hasMore,
      // The cursor is the OLDEST row on this page — the next page continues strictly
      // before it, which is what makes the pages neither overlap nor gap.
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    },
  };
}

function parseLimit(raw: string | null | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return INITIAL_MESSAGE_LIMIT;
  }

  // `Number` accepts "  30  " and "3e1"; the contract says integer. A strict pattern
  // keeps "30abc" and "1e2" out rather than relying on parseInt's prefix behaviour.
  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const value = Number(raw);

  if (value < 1 || value > MAX_MESSAGE_LIMIT) {
    return null;
  }

  return value;
}
