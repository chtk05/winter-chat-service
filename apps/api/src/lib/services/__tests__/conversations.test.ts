import type {
  ConversationRow,
  ConversationStatus,
} from "@/lib/services/chat-types";
import {
  CONVERSATION_PAGE_LIMIT,
  getConversation,
  listConversations,
  markConversationRead,
  setConversationStatus,
  type ConversationListRow,
  type ConversationStore,
} from "@/lib/services/conversations";

function conversation(
  id: string,
  overrides: Partial<ConversationRow> = {},
): ConversationRow {
  return {
    id,
    status: "Open",
    unread: false,
    lastMessageAt: new Date("2026-08-13T09:00:00.000Z"),
    contact: {
      id: `contact-${id}`,
      lineUserId: `U${id}`,
      displayName: `Contact ${id}`,
      avatarUrl: null,
      firstSeenAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    ...overrides,
  };
}

interface StoreState {
  rows?: ConversationListRow[];
  totals?: { matching: number; all: number; open: number };
  found?: ConversationRow | null;
  messageCount?: number;
  snippet?: string;
  readOk?: boolean;
}

function createStore(state: StoreState = {}) {
  const calls = {
    list: [] as Array<{ status?: string; search?: string; take: number }>,
    totals: [] as Array<{ status?: string; search?: string }>,
    updated: [] as Array<{ id: string; status: ConversationStatus }>,
    read: [] as string[],
  };

  const store: ConversationStore = {
    async listLatestPerContact(args) {
      calls.list.push({
        status: args.status,
        search: args.search,
        take: args.take,
      });
      return (state.rows ?? []).slice(0, args.take);
    },
    async countTotals(args) {
      calls.totals.push({ status: args.status, search: args.search });
      return state.totals ?? { matching: 0, all: 0, open: 0 };
    },
    async findById() {
      return state.found === undefined ? null : state.found;
    },
    async countMessages() {
      return state.messageCount ?? 0;
    },
    async latestSnippet() {
      return state.snippet;
    },
    async updateStatus(id, status) {
      calls.updated.push({ id, status });
      return state.found === undefined || state.found === null
        ? null
        : { ...state.found, status };
    },
    async markRead(id) {
      calls.read.push(id);
      return state.readOk ?? true;
    },
  };

  return { store, calls };
}

describe("listConversations — positive cases (T-013, D-048)", () => {
  it("returns rows in the order the store gave them, with the contact and channel", async () => {
    const { store } = createStore({
      rows: [
        { conversation: conversation("a"), snippet: "hello" },
        { conversation: conversation("b") },
      ],
      totals: { matching: 2, all: 2, open: 2 },
    });

    const result = await listConversations({}, store);
    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.list.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.list.items[0]).toMatchObject({
      channel: "LINE",
      snippet: "hello",
      contact: { lineUserId: "Ua", displayName: "Contact a" },
    });
    // A conversation with no messages carries no snippet rather than an empty string.
    expect(result.list.items[1]).not.toHaveProperty("snippet");
  });

  it("returns totals describing the whole filtered set, not the page", async () => {
    const { store } = createStore({
      rows: [{ conversation: conversation("a") }],
      totals: { matching: 1, all: 4, open: 2 },
    });

    const result = await listConversations({}, store);
    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.list.totals).toEqual({ matching: 1, all: 4, open: 2 });
  });

  it("passes the status filter to BOTH the list and the totals", async () => {
    // If a filter reached only one of them the footer would contradict the rows.
    const { store, calls } = createStore();

    await listConversations({ status: "Pending" }, store);

    expect(calls.list[0].status).toBe("Pending");
    expect(calls.totals[0].status).toBe("Pending");
  });

  it("trims the search term and passes it to both", async () => {
    const { store, calls } = createStore();

    await listConversations({ search: "  refund  " }, store);

    expect(calls.list[0].search).toBe("refund");
    expect(calls.totals[0].search).toBe("refund");
  });

  it("asks for one more row than the page size, to learn hasMore in one read", async () => {
    const { store, calls } = createStore();

    await listConversations({}, store);

    expect(calls.list[0].take).toBe(CONVERSATION_PAGE_LIMIT + 1);
  });

  it("returns ONE row per contact — D-048's negative case, asserted positively", async () => {
    // The store is contracted to return the latest conversation per contact. This asserts
    // the service does not then fan a contact back out into several rows.
    const { store } = createStore({
      rows: [{ conversation: conversation("newer"), snippet: "the newer one" }],
      totals: { matching: 1, all: 1, open: 1 },
    });

    const result = await listConversations({}, store);
    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.list.items).toHaveLength(1);
    expect(result.list.items[0].id).toBe("newer");
  });

  it("sets a next cursor only when a further page exists", async () => {
    const many = Array.from(
      { length: CONVERSATION_PAGE_LIMIT + 1 },
      (_, index) => ({
        conversation: conversation(`c-${index}`),
      }),
    );
    const { store } = createStore({ rows: many });

    const result = await listConversations({}, store);
    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.list.items).toHaveLength(CONVERSATION_PAGE_LIMIT);
    expect(result.list.nextCursor).toBe(`c-${CONVERSATION_PAGE_LIMIT - 1}`);
  });
});

describe("listConversations — negative cases required by T-013", () => {
  it("renders zero conversations as an empty list with zero totals, not nulls", async () => {
    const { store } = createStore({
      rows: [],
      totals: { matching: 0, all: 0, open: 0 },
    });

    const result = await listConversations({}, store);
    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.list.items).toEqual([]);
    expect(result.list.totals).toEqual({ matching: 0, all: 0, open: 0 });
    expect(result.list.nextCursor).toBeNull();
  });

  it("renders a filter with no matches as empty, with `all` still populated", async () => {
    const { store } = createStore({
      rows: [],
      totals: { matching: 0, all: 7, open: 3 },
    });

    const result = await listConversations({ status: "Closed" }, store);
    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.list.items).toEqual([]);
    expect(result.list.totals.all).toBe(7);
  });

  it("treats an empty search string as absent (openapi.yaml says so outright)", async () => {
    const { store, calls } = createStore();

    await listConversations({ search: "" }, store);

    expect(calls.list[0].search).toBeUndefined();
  });

  it("treats a whitespace-only search as absent", async () => {
    const { store, calls } = createStore();

    await listConversations({ search: "   " }, store);

    expect(calls.list[0].search).toBeUndefined();
  });

  it.each([
    ["an unknown status", "Archived"],
    ["a lowercase status", "open"],
    ["a numeric status", "1"],
  ])("rejects %s rather than ignoring the filter", async (_label, status) => {
    // Ignoring it would silently answer the All filter, showing more than was asked for.
    const { store, calls } = createStore();

    await expect(listConversations({ status }, store)).resolves.toEqual({
      outcome: "invalid-status",
    });
    expect(calls.list).toEqual([]);
  });
});

describe("getConversation", () => {
  it("returns the conversation with its message count", async () => {
    const { store } = createStore({
      found: conversation("a"),
      messageCount: 12,
      snippet: "latest",
    });

    const result = await getConversation("a", store);
    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.conversation).toMatchObject({
      id: "a",
      messageCount: 12,
      snippet: "latest",
    });
  });

  it("reports an unknown id as not-found", async () => {
    const { store } = createStore({ found: null });

    await expect(getConversation("nope", store)).resolves.toEqual({
      outcome: "not-found",
    });
  });
});

describe("setConversationStatus — D-019, the only mutable field", () => {
  it.each(["Open", "Pending", "Closed"] as const)(
    "accepts the %s status",
    async (status) => {
      const { store, calls } = createStore({ found: conversation("a") });

      const result = await setConversationStatus("a", status, store);
      if (result.outcome !== "ok") throw new Error("expected ok");

      expect(result.conversation.status).toBe(status);
      expect(calls.updated).toEqual([{ id: "a", status }]);
    },
  );

  it("changes the status of a conversation with no messages", async () => {
    const { store } = createStore({
      found: conversation("a"),
      messageCount: 0,
    });

    const result = await setConversationStatus("a", "Closed", store);
    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.conversation).toMatchObject({
      status: "Closed",
      messageCount: 0,
    });
  });

  it("reports an unknown id as not-found", async () => {
    const { store } = createStore({ found: null });

    await expect(setConversationStatus("nope", "Open", store)).resolves.toEqual(
      {
        outcome: "not-found",
      },
    );
  });

  it.each([
    ["an unknown status", "Archived"],
    ["a lowercase status", "open"],
    ["undefined", undefined],
    ["null", null],
    ["a number", 1],
    ["an object", { status: "Open" }],
  ])("rejects %s without writing", async (_label, status) => {
    const { store, calls } = createStore({ found: conversation("a") });

    await expect(setConversationStatus("a", status, store)).resolves.toEqual({
      outcome: "invalid-status",
    });
    expect(calls.updated).toEqual([]);
  });
});

describe("markConversationRead — D-007", () => {
  it("marks the conversation read", async () => {
    const { store, calls } = createStore({ readOk: true });

    await expect(markConversationRead("a", store)).resolves.toBe("ok");
    expect(calls.read).toEqual(["a"]);
  });

  it("is idempotent — marking an already-read conversation still succeeds", async () => {
    const { store } = createStore({ readOk: true });

    await expect(markConversationRead("a", store)).resolves.toBe("ok");
    await expect(markConversationRead("a", store)).resolves.toBe("ok");
  });

  it("reports an unknown id as not-found", async () => {
    const { store } = createStore({ readOk: false });

    await expect(markConversationRead("nope", store)).resolves.toBe(
      "not-found",
    );
  });
});
