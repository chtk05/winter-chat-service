import {
  toMessageDto,
  type MessageDto,
  type MessageRow,
} from "@/lib/services/chat-types";

export const INITIAL_MESSAGE_LIMIT = 30;
export const MAX_MESSAGE_LIMIT = 50;

export interface ThreadStore {
  conversationExists(conversationId: string): Promise<boolean>;
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
      items: page.map(toMessageDto).reverse(),
      hasMore,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    },
  };
}

function parseLimit(raw: string | null | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return INITIAL_MESSAGE_LIMIT;
  }

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const value = Number(raw);

  if (value < 1 || value > MAX_MESSAGE_LIMIT) {
    return null;
  }

  return value;
}
