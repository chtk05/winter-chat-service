import type { MessageRow } from "@/lib/services/chat-types";
import {
  INITIAL_MESSAGE_LIMIT,
  MAX_MESSAGE_LIMIT,
  listThreadMessages,
  type ThreadStore,
} from "@/lib/services/thread";

const CONVERSATION_ID = "conv-1";

function messages(count: number): MessageRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `m-${count - index}`,
    conversationId: CONVERSATION_ID,
    clientId: null,
    direction: index % 2 === 0 ? "inbound" : "outbound",
    messageType: "text",
    text: `message ${count - index}`,
    deliveryStatus: null,
    failureReason: null,
    sentVia: null,
    createdAt: new Date(Date.UTC(2026, 7, 13, 9, count - index)),
  })) as MessageRow[];
}

function createStore(
  all: MessageRow[],
  { exists = true }: { exists?: boolean } = {},
): ThreadStore & { calls: Array<{ before?: string; take: number }> } {
  const calls: Array<{ before?: string; take: number }> = [];

  return {
    calls,
    async conversationExists() {
      return exists;
    },
    async listMessagesDescending({ before, take }) {
      calls.push({ before, take });

      const startIndex = before
        ? all.findIndex((message) => message.id === before) + 1
        : 0;

      return all.slice(startIndex, startIndex + take);
    },
  };
}

describe("listThreadMessages — positive cases (T-014, D-026)", () => {
  it("returns the initial 30 when no limit is given", async () => {
    const store = createStore(messages(100));
    const result = await listThreadMessages(
      { conversationId: CONVERSATION_ID },
      store,
    );

    expect(result).toMatchObject({ outcome: "ok" });
    if (result.outcome !== "ok") return;

    expect(result.page.items).toHaveLength(INITIAL_MESSAGE_LIMIT);
    expect(INITIAL_MESSAGE_LIMIT).toBe(30);
  });

  it("asks the store for one more row than requested, to learn hasMore in one read", async () => {
    const store = createStore(messages(100));
    await listThreadMessages({ conversationId: CONVERSATION_ID }, store);

    expect(store.calls[0].take).toBe(INITIAL_MESSAGE_LIMIT + 1);
  });

  it("returns messages NEWEST LAST, though the store reads newest first", async () => {
    const store = createStore(messages(5));
    const result = await listThreadMessages(
      { conversationId: CONVERSATION_ID, limit: "5" },
      store,
    );

    if (result.outcome !== "ok") throw new Error("expected ok");

    const times = result.page.items.map((item) => Date.parse(item.createdAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(result.page.items[result.page.items.length - 1].id).toBe("m-5");
  });

  it("continues the next page with no overlap and no gap", async () => {
    const all = messages(10);
    const store = createStore(all);

    const first = await listThreadMessages(
      { conversationId: CONVERSATION_ID, limit: "4" },
      store,
    );
    if (first.outcome !== "ok") throw new Error("expected ok");

    const second = await listThreadMessages(
      {
        conversationId: CONVERSATION_ID,
        limit: "4",
        before: first.page.nextCursor,
      },
      store,
    );
    if (second.outcome !== "ok") throw new Error("expected ok");

    const firstIds = first.page.items.map((item) => item.id);
    const secondIds = second.page.items.map((item) => item.id);

    expect(firstIds.filter((id) => secondIds.includes(id))).toEqual([]);
    expect([...secondIds, ...firstIds]).toEqual([
      "m-3",
      "m-4",
      "m-5",
      "m-6",
      "m-7",
      "m-8",
      "m-9",
      "m-10",
    ]);
  });

  it("reports hasMore false and a null cursor on the last page", async () => {
    const store = createStore(messages(4));
    const result = await listThreadMessages(
      { conversationId: CONVERSATION_ID, limit: "10" },
      store,
    );

    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.page.hasMore).toBe(false);
    expect(result.page.nextCursor).toBeNull();
  });

  it("accepts the maximum limit of 50 (D-026)", async () => {
    const store = createStore(messages(100));
    const result = await listThreadMessages(
      { conversationId: CONVERSATION_ID, limit: String(MAX_MESSAGE_LIMIT) },
      store,
    );

    expect(result).toMatchObject({ outcome: "ok" });
    expect(MAX_MESSAGE_LIMIT).toBe(50);
  });

  it("carries a non-text placeholder's LINE type through (D-010)", async () => {
    const placeholder: MessageRow = {
      ...messages(1)[0],
      messageType: "sticker",
      text: null,
    };
    const store = createStore([placeholder]);

    const result = await listThreadMessages(
      { conversationId: CONVERSATION_ID },
      store,
    );
    if (result.outcome !== "ok") throw new Error("expected ok");

    expect(result.page.items[0]).toMatchObject({
      messageType: "sticker",
      text: null,
    });
  });
});

describe("listThreadMessages — negative cases required by T-014", () => {
  it("returns an empty page rather than erroring past the end", async () => {
    const store = createStore(messages(3));
    const result = await listThreadMessages(
      { conversationId: CONVERSATION_ID, before: "m-1", limit: "10" },
      store,
    );

    expect(result).toEqual({
      outcome: "ok",
      page: { items: [], hasMore: false, nextCursor: null },
    });
  });

  it("reports an unknown conversation as not-found without reading messages", async () => {
    const store = createStore(messages(10), { exists: false });

    await expect(
      listThreadMessages({ conversationId: "nope" }, store),
    ).resolves.toEqual({ outcome: "not-found" });

    expect(store.calls).toEqual([]);
  });

  it("REJECTS a limit above the maximum rather than clamping it (D-026)", async () => {
    const store = createStore(messages(100));

    await expect(
      listThreadMessages(
        {
          conversationId: CONVERSATION_ID,
          limit: String(MAX_MESSAGE_LIMIT + 1),
        },
        store,
      ),
    ).resolves.toEqual({ outcome: "invalid-limit" });

    expect(store.calls).toEqual([]);
  });

  it.each([
    ["zero", "0"],
    ["negative", "-1"],
    ["fractional", "1.5"],
    ["non-numeric", "abc"],
    ["numeric with a suffix", "30abc"],
    ["exponential notation", "3e1"],
    ["whitespace-padded", " 30 "],
    ["absurdly large", "99999999"],
  ])("rejects a %s limit", async (_label, limit) => {
    const store = createStore(messages(100));

    await expect(
      listThreadMessages({ conversationId: CONVERSATION_ID, limit }, store),
    ).resolves.toEqual({ outcome: "invalid-limit" });
  });

  it("validates the limit BEFORE checking the conversation exists", async () => {
    const store = createStore(messages(10), { exists: false });

    await expect(
      listThreadMessages({ conversationId: "nope", limit: "999" }, store),
    ).resolves.toEqual({ outcome: "invalid-limit" });
  });

  it("treats an absent or empty limit as the initial page size, not an error", async () => {
    const store = createStore(messages(100));

    for (const limit of [undefined, null, ""]) {
      const result = await listThreadMessages(
        { conversationId: CONVERSATION_ID, limit },
        store,
      );
      expect(result).toMatchObject({ outcome: "ok" });
    }
  });
});
