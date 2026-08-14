import { createHmac } from "node:crypto";

import { fixedClock } from "@/lib/clock";
import type { LineClient } from "@/lib/line/client";
import type { ConversationStatus } from "@/lib/services/chat-types";
import { ingestWebhook, type WebhookStore } from "@/lib/services/webhook";

const SECRET = "line-channel-secret";
const NOW = new Date("2026-08-13T09:00:00.000Z");
const LINE_USER_ID = "U8f2c000000000000000000000000004471";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

function messageEvent(
  overrides: {
    id?: string;
    userId?: string;
    type?: string;
    text?: string;
    replyToken?: string | null;
  } = {},
): object {
  return {
    type: "message",
    webhookEventId: overrides.id ?? "evt-1",
    ...(overrides.replyToken === null
      ? {}
      : { replyToken: overrides.replyToken ?? "reply-token-1" }),
    source: { type: "user", userId: overrides.userId ?? LINE_USER_ID },
    message: {
      id: "msg-1",
      type: overrides.type ?? "text",
      ...(overrides.type && overrides.type !== "text"
        ? {}
        : { text: overrides.text ?? "hello" }),
    },
  };
}

function body(events: object[]): string {
  return JSON.stringify({ destination: "Uoa", events });
}

interface StoreState {
  seenEvents?: string[];
  existingContact?: boolean;
  existingConversation?: { id: string; status: ConversationStatus } | null;
}

function createStore(state: StoreState = {}) {
  const seen = new Set(state.seenEvents ?? []);

  const calls = {
    recorded: [] as string[],
    contactsCreated: [] as Array<{
      displayName: string;
      avatarUrl: string | null;
    }>,
    conversationsCreated: [] as string[],
    messages: [] as Array<{
      conversationId: string;
      messageType: string;
      text: string | null;
      reopenAsPending: boolean;
    }>,
    replyTokens: [] as string[],
  };

  const store: WebhookStore = {
    async recordEvent(lineEventId) {
      calls.recorded.push(lineEventId);
      if (seen.has(lineEventId)) {
        return false;
      }
      seen.add(lineEventId);
      return true;
    },
    async findContactByLineUserId() {
      return state.existingContact ? { id: "contact-1" } : null;
    },
    async createContact(args) {
      calls.contactsCreated.push({
        displayName: args.displayName,
        avatarUrl: args.avatarUrl,
      });
      return { id: "contact-1" };
    },
    async latestConversationForContact() {
      return state.existingConversation ?? null;
    },
    async createConversation(args) {
      calls.conversationsCreated.push(args.contactId);
      return { id: "conv-new" };
    },
    async appendInboundMessage(args) {
      calls.messages.push({
        conversationId: args.conversationId,
        messageType: args.messageType,
        text: args.text,
        reopenAsPending: args.reopenAsPending,
      });
    },
    async saveReplyToken(args) {
      calls.replyTokens.push(args.value);
    },
  };

  return { store, calls };
}

function createLine(
  profile: { displayName: string; avatarUrl: string | null } | null,
) {
  const calls: string[] = [];
  const line: LineClient = {
    async fetchProfile(lineUserId) {
      calls.push(lineUserId);
      return profile;
    },
  };
  return { line, calls };
}

function dependencies(
  store: WebhookStore,
  line: LineClient,
  channelSecret = SECRET,
) {
  return { channelSecret, store, line, clock: fixedClock(NOW) };
}

describe("ingestWebhook — positive cases (T-006, D-012, D-013)", () => {
  it("stores exactly one message for a valid signed event", async () => {
    const { store, calls } = createStore();
    const { line } = createLine({ displayName: "Aom", avatarUrl: null });
    const raw = body([messageEvent()]);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "accepted", stored: 1, skipped: 0 });

    expect(calls.messages).toHaveLength(1);
    expect(calls.messages[0]).toMatchObject({
      messageType: "text",
      text: "hello",
    });
  });

  it("fetches the profile for a FIRST-TIME contact and stores the name", async () => {
    const { store, calls } = createStore({ existingContact: false });
    const { line, calls: lineCalls } = createLine({
      displayName: "Nattapong",
      avatarUrl: "https://line/pic.jpg",
    });
    const raw = body([messageEvent()]);

    await ingestWebhook(
      { rawBody: raw, signature: sign(raw) },
      dependencies(store, line),
    );

    expect(lineCalls).toEqual([LINE_USER_ID]);
    expect(calls.contactsCreated).toEqual([
      { displayName: "Nattapong", avatarUrl: "https://line/pic.jpg" },
    ]);
  });

  it("does NOT fetch the profile for a known contact (D-013)", async () => {
    // A regression here is a LINE API call on every single inbound message.
    const { store, calls } = createStore({ existingContact: true });
    const { line, calls: lineCalls } = createLine({
      displayName: "Aom",
      avatarUrl: null,
    });
    const raw = body([messageEvent()]);

    await ingestWebhook(
      { rawBody: raw, signature: sign(raw) },
      dependencies(store, line),
    );

    expect(lineCalls).toEqual([]);
    expect(calls.contactsCreated).toEqual([]);
  });

  it("creates a conversation on first contact (D-047 creates it Open)", async () => {
    const { store, calls } = createStore({ existingConversation: null });
    const { line } = createLine(null);
    const raw = body([messageEvent()]);

    await ingestWebhook(
      { rawBody: raw, signature: sign(raw) },
      dependencies(store, line),
    );

    expect(calls.conversationsCreated).toEqual(["contact-1"]);
    expect(calls.messages[0].conversationId).toBe("conv-new");
  });

  it("stores the reply token when the event carries one (D-006)", async () => {
    const { store, calls } = createStore();
    const { line } = createLine(null);
    const raw = body([messageEvent({ replyToken: "rt-abc" })]);

    await ingestWebhook(
      { rawBody: raw, signature: sign(raw) },
      dependencies(store, line),
    );

    expect(calls.replyTokens).toEqual(["rt-abc"]);
  });

  it("processes several events in one batch", async () => {
    const { store, calls } = createStore();
    const { line } = createLine(null);
    const raw = body([
      messageEvent({ id: "evt-1", text: "one" }),
      messageEvent({ id: "evt-2", text: "two" }),
    ]);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "accepted", stored: 2, skipped: 0 });

    expect(calls.messages.map((m) => m.text)).toEqual(["one", "two"]);
  });
});

describe("ingestWebhook — D-047 status transitions", () => {
  it("REOPENS a Closed conversation as Pending", async () => {
    const { store, calls } = createStore({
      existingConversation: { id: "conv-old", status: "Closed" },
    });
    const { line } = createLine(null);
    const raw = body([messageEvent()]);

    await ingestWebhook(
      { rawBody: raw, signature: sign(raw) },
      dependencies(store, line),
    );

    // D-048: the SAME conversation, not a new one.
    expect(calls.conversationsCreated).toEqual([]);
    expect(calls.messages[0]).toMatchObject({
      conversationId: "conv-old",
      reopenAsPending: true,
    });
  });

  it.each(["Open", "Pending"] as const)(
    "leaves a %s conversation's status unchanged",
    async (status) => {
      const { store, calls } = createStore({
        existingConversation: { id: "conv-old", status },
      });
      const { line } = createLine(null);
      const raw = body([messageEvent()]);

      await ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(store, line),
      );

      expect(calls.messages[0].reopenAsPending).toBe(false);
    },
  );
});

describe("ingestWebhook — negative cases required by T-006 and D-012", () => {
  it("rejects a MISSING signature header with no write at all", async () => {
    const { store, calls } = createStore();
    const { line, calls: lineCalls } = createLine(null);
    const raw = body([messageEvent()]);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: null },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "unauthorized" });

    expect(calls.recorded).toEqual([]);
    expect(calls.messages).toEqual([]);
    expect(lineCalls).toEqual([]);
  });

  it("rejects a WRONG signature with no write", async () => {
    const { store, calls } = createStore();
    const { line } = createLine(null);
    const raw = body([messageEvent()]);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: sign(raw, "attacker-secret") },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "unauthorized" });

    expect(calls.messages).toEqual([]);
  });

  it("rejects a TAMPERED body carrying a valid signature for different content", async () => {
    const { store, calls } = createStore();
    const { line } = createLine(null);
    const original = body([messageEvent({ text: "harmless" })]);
    const tampered = body([messageEvent({ text: "injected" })]);

    await expect(
      ingestWebhook(
        { rawBody: tampered, signature: sign(original) },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "unauthorized" });

    expect(calls.messages).toEqual([]);
  });

  it("stores NO second row for a duplicate event id (D-012)", async () => {
    const { store, calls } = createStore({ seenEvents: ["evt-1"] });
    const { line } = createLine(null);
    const raw = body([messageEvent({ id: "evt-1" })]);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "accepted", stored: 0, skipped: 1 });

    expect(calls.messages).toEqual([]);
  });

  it("deduplicates a redelivered event within the same batch", async () => {
    const { store, calls } = createStore();
    const { line } = createLine(null);
    const raw = body([
      messageEvent({ id: "evt-1" }),
      messageEvent({ id: "evt-1" }),
    ]);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "accepted", stored: 1, skipped: 1 });

    expect(calls.messages).toHaveLength(1);
  });

  it.each([
    ["not JSON at all", "this is not json"],
    ["a JSON array", "[]"],
    ["a JSON string", '"hello"'],
    ["JSON null", "null"],
    ["an object with no events key", '{"destination":"Uoa"}'],
    ["events that is not an array", '{"events":"nope"}'],
  ])("reports a payload that is %s as malformed", async (_label, raw) => {
    const { store, calls } = createStore();
    const { line } = createLine(null);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "malformed" });

    expect(calls.messages).toEqual([]);
  });

  it("verifies the signature BEFORE parsing, so an unsigned malformed body is 401", async () => {
    // Order matters: an attacker must not be able to tell malformed from unsigned.
    const { store } = createStore();
    const { line } = createLine(null);

    await expect(
      ingestWebhook(
        { rawBody: "not json", signature: null },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "unauthorized" });
  });

  it.each([
    ["image", "image"],
    ["sticker", "sticker"],
    ["location", "location"],
    ["file", "file"],
    ["video", "video"],
    ["audio", "audio"],
  ])(
    "stores a %s message as a placeholder carrying its LINE type (D-010)",
    async (_label, type) => {
      const { store, calls } = createStore();
      const { line } = createLine(null);
      const raw = body([messageEvent({ type })]);

      await ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(store, line),
      );

      expect(calls.messages[0]).toMatchObject({
        messageType: type,
        text: null,
      });
    },
  );

  it("still stores the message when the profile fetch FAILS, falling back to the LINE user id", async () => {
    // D-013: a profile-API failure must not block storing the inbound message.
    const { store, calls } = createStore({ existingContact: false });
    const { line } = createLine(null);
    const raw = body([messageEvent()]);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "accepted", stored: 1, skipped: 0 });

    expect(calls.contactsCreated).toEqual([
      { displayName: LINE_USER_ID, avatarUrl: null },
    ]);
    expect(calls.messages).toHaveLength(1);
  });

  it.each([
    [
      "a non-message event",
      { type: "follow", webhookEventId: "e", source: {} },
    ],
    ["a postback", { type: "postback", webhookEventId: "e", source: {} }],
    [
      "an event with no webhookEventId",
      { type: "message", source: {}, message: {} },
    ],
    [
      "an event with no source userId (a group)",
      {
        type: "message",
        webhookEventId: "e",
        source: { type: "group", groupId: "G1" },
        message: { type: "text", text: "hi" },
      },
    ],
    [
      "an event with no message object",
      { type: "message", webhookEventId: "e", source: { userId: "U1" } },
    ],
    [
      "an event whose message has no type",
      {
        type: "message",
        webhookEventId: "e",
        source: { userId: "U1" },
        message: { text: "hi" },
      },
    ],
    ["a null event", null],
    ["a string event", "nope"],
  ])("DROPS %s without erroring the batch", async (_label, event) => {
    // LINE sends these legitimately. 400-ing the batch would make it retry a payload that
    // can never succeed.
    const { store, calls } = createStore();
    const { line } = createLine(null);
    const raw = body([event as object]);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(store, line),
      ),
    ).resolves.toEqual({ outcome: "accepted", stored: 0, skipped: 0 });

    expect(calls.messages).toEqual([]);
  });

  it("stores the valid events in a batch that also contains droppable ones", async () => {
    const { store, calls } = createStore();
    const { line } = createLine(null);
    const raw = body([
      {
        type: "follow",
        webhookEventId: "e0",
        source: { userId: LINE_USER_ID },
      },
      messageEvent({ id: "evt-1", text: "real" }),
    ]);

    await ingestWebhook(
      { rawBody: raw, signature: sign(raw) },
      dependencies(store, line),
    );

    expect(calls.messages).toHaveLength(1);
    expect(calls.messages[0].text).toBe("real");
  });

  it("propagates a store failure rather than answering accepted", async () => {
    // Swallowing it would return 200 and lose the message permanently. A throw becomes a
    // 500, LINE retries, and the dedupe makes the retry safe.
    const { store } = createStore();
    const { line } = createLine(null);
    const failing: WebhookStore = {
      ...store,
      async appendInboundMessage() {
        throw new Error("database unreachable");
      },
    };
    const raw = body([messageEvent()]);

    await expect(
      ingestWebhook(
        { rawBody: raw, signature: sign(raw) },
        dependencies(failing, line),
      ),
    ).rejects.toThrow("database unreachable");
  });
});
