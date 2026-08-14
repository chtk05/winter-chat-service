import { fixedClock } from "@/lib/clock";
import type { LineClient } from "@/lib/line/client";
import type { MessageRow } from "@/lib/services/chat-types";
import {
  retryMessage,
  sendMessage,
  type SendDependencies,
  type SendStore,
} from "@/lib/services/send";

const NOW = new Date("2026-08-13T09:00:00.000Z");
const CONVERSATION_ID = "conv-1";
const CONTACT_LINE_USER_ID = "U8f2c000000000000000000000000004471";
const CLIENT_ID = "11111111-1111-1111-1111-111111111111";

function messageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: "msg-1",
    conversationId: CONVERSATION_ID,
    clientId: CLIENT_ID,
    direction: "outbound",
    messageType: "text",
    text: "hello",
    mediaUrl: null,
    deliveryStatus: "sending",
    failureReason: null,
    sentVia: null,
    createdAt: NOW,
    ...overrides,
  };
}

interface StoreState {
  conversationExists?: boolean;
  existingByClientId?: MessageRow | null;
  unusedToken?: { value: string } | null;
  existingMessage?: MessageRow | null;
}

function createStore(state: StoreState = {}) {
  const messages = new Map<string, MessageRow>();
  const tokensUsed: string[] = [];
  const closedConversations: string[] = [];
  let nextId = 1;

  if (state.existingMessage) {
    messages.set(state.existingMessage.id, state.existingMessage);
  }

  const store: SendStore = {
    async findConversationForSend(conversationId) {
      if (state.conversationExists === false) return null;
      if (
        conversationId !== CONVERSATION_ID &&
        state.conversationExists !== true
      ) {
        return null;
      }
      return { id: CONVERSATION_ID, contactLineUserId: CONTACT_LINE_USER_ID };
    },

    async findMessageByClientId(clientId) {
      if (state.existingByClientId !== undefined) {
        return clientId === CLIENT_ID ? state.existingByClientId : null;
      }
      for (const message of messages.values()) {
        if (message.clientId === clientId) return message;
      }
      return null;
    },

    async createSendingMessage({
      conversationId,
      clientId,
      messageType,
      text,
      mediaUrl,
      createdAt,
    }) {
      const id = `msg-${nextId++}`;
      const row = messageRow({
        id,
        conversationId,
        clientId,
        messageType,
        text,
        mediaUrl,
        createdAt,
        deliveryStatus: "sending",
      });
      messages.set(id, row);
      return row;
    },

    async findUnusedReplyToken() {
      return state.unusedToken === undefined ? null : state.unusedToken;
    },

    async markReplyTokenUsed(value) {
      tokensUsed.push(value);
    },

    async resolveMessage({ id, deliveryStatus, sentVia, failureReason }) {
      const existing = messages.get(id) ?? messageRow({ id });
      const updated = { ...existing, deliveryStatus, sentVia, failureReason };
      messages.set(id, updated);
      return updated;
    },

    async closeConversation(conversationId) {
      closedConversations.push(conversationId);
    },

    async findMessageById(id) {
      return messages.get(id) ?? null;
    },

    async markMessageSending(id) {
      const existing = messages.get(id);
      if (!existing) throw new Error("not found");
      const updated = {
        ...existing,
        deliveryStatus: "sending" as const,
        failureReason: null,
      };
      messages.set(id, updated);
      return updated;
    },
  };

  return { store, messages, tokensUsed, closedConversations };
}

function createLine(overrides: Partial<LineClient> = {}) {
  const replyCalls: Array<{ token: string; text: string }> = [];
  const pushCalls: Array<{ lineUserId: string; text: string }> = [];
  const replyImageCalls: Array<{ token: string; imageUrl: string }> = [];
  const pushImageCalls: Array<{ lineUserId: string; imageUrl: string }> = [];

  const line: LineClient = {
    async fetchProfile() {
      return null;
    },
    async fetchContent() {
      return null;
    },
    async replyMessage(token, text) {
      replyCalls.push({ token, text });
      return overrides.replyMessage
        ? overrides.replyMessage(token, text)
        : true;
    },
    async pushMessage(lineUserId, text) {
      pushCalls.push({ lineUserId, text });
      return overrides.pushMessage
        ? overrides.pushMessage(lineUserId, text)
        : true;
    },
    async replyImage(token, imageUrl) {
      replyImageCalls.push({ token, imageUrl });
      return overrides.replyImage
        ? overrides.replyImage(token, imageUrl)
        : true;
    },
    async pushImage(lineUserId, imageUrl) {
      pushImageCalls.push({ lineUserId, imageUrl });
      return overrides.pushImage
        ? overrides.pushImage(lineUserId, imageUrl)
        : true;
    },
  };

  return { line, replyCalls, pushCalls, replyImageCalls, pushImageCalls };
}

function deps(store: SendStore, line: LineClient): SendDependencies {
  return { store, line, clock: fixedClock(NOW) };
}

describe("sendMessage — positive cases (D-006, D-013, D-021)", () => {
  it("delivers via Reply when an unused token exists, marks it used, and resolves sent", async () => {
    const { store, tokensUsed } = createStore({
      unusedToken: { value: "reply-token-1" },
    });
    const { line, replyCalls, pushCalls } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hello",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.deliveryStatus).toBe("sent");
    expect(result.message.sentVia).toBe("reply");
    expect(replyCalls).toEqual([{ token: "reply-token-1", text: "hello" }]);
    expect(pushCalls).toHaveLength(0);
    expect(tokensUsed).toEqual(["reply-token-1"]);
  });

  it("retrying a failed message re-sends and can resolve sent", async () => {
    const failed = messageRow({
      id: "msg-failed",
      deliveryStatus: "failed",
      failureReason: "x",
    });
    const { store } = createStore({
      existingMessage: failed,
      unusedToken: null,
    });
    const { line } = createLine();

    const result = await retryMessage("msg-failed", deps(store, line));

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.deliveryStatus).toBe("sent");
    expect(result.message.failureReason).toBeNull();
  });

  it("a repeated clientId returns the original message without sending again", async () => {
    const existing = messageRow({ deliveryStatus: "sent", sentVia: "push" });
    const { store } = createStore({ existingByClientId: existing });
    const { line, replyCalls, pushCalls } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hello",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message).toEqual(
      expect.objectContaining({ id: existing.id, deliveryStatus: "sent" }),
    );
    expect(replyCalls).toHaveLength(0);
    expect(pushCalls).toHaveLength(0);
  });
});

describe("sendMessage — negative cases required by T-008", () => {
  it("no token stored sends directly via Push", async () => {
    const { store } = createStore({ unusedToken: null });
    const { line, replyCalls, pushCalls } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hi",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.sentVia).toBe("push");
    expect(result.message.deliveryStatus).toBe("sent");
    expect(replyCalls).toHaveLength(0);
    expect(pushCalls).toEqual([
      { lineUserId: CONTACT_LINE_USER_ID, text: "hi" },
    ]);
  });

  it("an already-used token is never offered, so Push is used directly", async () => {
    const { store } = createStore({ unusedToken: null });
    const { line, pushCalls } = createLine();

    await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hi",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(pushCalls).toHaveLength(1);
  });

  it("Reply errors, Push succeeds → sent via push, token still marked used", async () => {
    const { store, tokensUsed } = createStore({
      unusedToken: { value: "reply-token-1" },
    });
    const { line, replyCalls, pushCalls } = createLine({
      replyMessage: async () => false,
    });

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hi",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.deliveryStatus).toBe("sent");
    expect(result.message.sentVia).toBe("push");
    expect(replyCalls).toHaveLength(1);
    expect(pushCalls).toHaveLength(1);
    expect(tokensUsed).toEqual(["reply-token-1"]);
  });

  it("Reply errors, Push also errors → failed, sentVia null", async () => {
    const { store } = createStore({ unusedToken: { value: "reply-token-1" } });
    const { line } = createLine({
      replyMessage: async () => false,
      pushMessage: async () => false,
    });

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hi",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.deliveryStatus).toBe("failed");
    expect(result.message.sentVia).toBeNull();
    expect(result.message.failureReason).not.toBeNull();
  });

  it("empty text is rejected before any store or LINE call", async () => {
    const { store } = createStore();
    const { line, replyCalls, pushCalls } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("invalid-text");
    expect(replyCalls).toHaveLength(0);
    expect(pushCalls).toHaveLength(0);
  });

  it("whitespace-only text is rejected", async () => {
    const { store } = createStore();
    const { line } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "   \n\t  ",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("invalid-text");
  });

  it("oversized text (over 5000 chars) is rejected", async () => {
    const { store } = createStore();
    const { line } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "a".repeat(5001),
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("invalid-text");
  });

  it("exactly 5000 chars is accepted (boundary)", async () => {
    const { store } = createStore({ unusedToken: null });
    const { line } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "a".repeat(5000),
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
  });

  it("a missing clientId is rejected", async () => {
    const { store } = createStore();
    const { line } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hi",
        clientId: undefined,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("missing-client-id");
  });

  it("an empty-string clientId is rejected", async () => {
    const { store } = createStore();
    const { line } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hi",
        clientId: "",
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("missing-client-id");
  });

  it("an unknown conversation is rejected with not-found, before any LINE call", async () => {
    const { store } = createStore({ conversationExists: false });
    const { line, replyCalls, pushCalls } = createLine();

    const result = await sendMessage(
      {
        conversationId: "no-such-conv",
        text: "hi",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("not-found");
    expect(replyCalls).toHaveLength(0);
    expect(pushCalls).toHaveLength(0);
  });

  it("closeAfterSend where the send fails leaves the conversation status unchanged", async () => {
    const { store, closedConversations } = createStore({
      unusedToken: null,
    });
    const { line } = createLine({ pushMessage: async () => false });

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hi",
        clientId: CLIENT_ID,
        closeAfterSend: true,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.deliveryStatus).toBe("failed");
    expect(closedConversations).toHaveLength(0);
  });

  it("closeAfterSend where the send succeeds closes the conversation", async () => {
    const { store, closedConversations } = createStore({ unusedToken: null });
    const { line } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hi",
        clientId: CLIENT_ID,
        closeAfterSend: true,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    expect(closedConversations).toEqual([CONVERSATION_ID]);
  });

  it("closeAfterSend defaulting (omitted) does not close on success", async () => {
    const { store, closedConversations } = createStore({ unusedToken: null });
    const { line } = createLine();

    await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "hi",
        clientId: CLIENT_ID,
        closeAfterSend: undefined,
      },
      deps(store, line),
    );

    expect(closedConversations).toHaveLength(0);
  });
});

describe("sendMessage — images (D-058)", () => {
  const IMAGE_URL = "https://storage.test/chat-media/outbound/x.jpg";

  it("sends via replyImage when an unused token exists, no text stored", async () => {
    const { store, tokensUsed } = createStore({
      unusedToken: { value: "reply-token-1" },
    });
    const { line, replyImageCalls, pushImageCalls, replyCalls, pushCalls } =
      createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: undefined,
        mediaUrl: IMAGE_URL,
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.messageType).toBe("image");
    expect(result.message.text).toBeNull();
    expect(result.message.mediaUrl).toBe(IMAGE_URL);
    expect(result.message.deliveryStatus).toBe("sent");
    expect(result.message.sentVia).toBe("reply");
    expect(replyImageCalls).toEqual([
      { token: "reply-token-1", imageUrl: IMAGE_URL },
    ]);
    expect(pushImageCalls).toHaveLength(0);
    expect(replyCalls).toHaveLength(0);
    expect(pushCalls).toHaveLength(0);
    expect(tokensUsed).toEqual(["reply-token-1"]);
  });

  it("no token stored sends the image directly via pushImage", async () => {
    const { store } = createStore({ unusedToken: null });
    const { line, pushImageCalls } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: undefined,
        mediaUrl: IMAGE_URL,
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.sentVia).toBe("push");
    expect(pushImageCalls).toEqual([
      { lineUserId: CONTACT_LINE_USER_ID, imageUrl: IMAGE_URL },
    ]);
  });

  it("replyImage errors, pushImage succeeds → sent via push", async () => {
    const { store } = createStore({ unusedToken: { value: "reply-token-1" } });
    const { line, replyImageCalls, pushImageCalls } = createLine({
      replyImage: async () => false,
    });

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: undefined,
        mediaUrl: IMAGE_URL,
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.deliveryStatus).toBe("sent");
    expect(result.message.sentVia).toBe("push");
    expect(replyImageCalls).toHaveLength(1);
    expect(pushImageCalls).toHaveLength(1);
  });

  it("replyImage AND pushImage both error → failed, sentVia null", async () => {
    const { store } = createStore({ unusedToken: { value: "reply-token-1" } });
    const { line } = createLine({
      replyImage: async () => false,
      pushImage: async () => false,
    });

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: undefined,
        mediaUrl: IMAGE_URL,
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.deliveryStatus).toBe("failed");
    expect(result.message.sentVia).toBeNull();
  });

  it("a non-https mediaUrl is rejected before any LINE call", async () => {
    const { store } = createStore({ unusedToken: null });
    const { line, replyImageCalls, pushImageCalls } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: undefined,
        mediaUrl: "http://insecure.test/x.jpg",
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("invalid-media-url");
    expect(replyImageCalls).toHaveLength(0);
    expect(pushImageCalls).toHaveLength(0);
  });

  it("neither text nor mediaUrl present is rejected as invalid-text", async () => {
    const { store } = createStore();
    const { line } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: undefined,
        mediaUrl: undefined,
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("invalid-text");
  });

  it("mediaUrl takes precedence when both text and mediaUrl are present", async () => {
    const { store } = createStore({ unusedToken: null });
    const { line, pushCalls, pushImageCalls } = createLine();

    const result = await sendMessage(
      {
        conversationId: CONVERSATION_ID,
        text: "ignored",
        mediaUrl: IMAGE_URL,
        clientId: CLIENT_ID,
        closeAfterSend: false,
      },
      deps(store, line),
    );

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.messageType).toBe("image");
    expect(result.message.text).toBeNull();
    expect(pushImageCalls).toHaveLength(1);
    expect(pushCalls).toHaveLength(0);
  });

  it("retrying a failed image message re-sends via the image APIs, not text", async () => {
    const failedImage = messageRow({
      id: "msg-failed-image",
      messageType: "image",
      text: null,
      mediaUrl: IMAGE_URL,
      deliveryStatus: "failed",
    });
    const { store } = createStore({
      existingMessage: failedImage,
      unusedToken: null,
    });
    const { line, pushImageCalls, pushCalls } = createLine();

    const result = await retryMessage("msg-failed-image", deps(store, line));

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.deliveryStatus).toBe("sent");
    expect(pushImageCalls).toHaveLength(1);
    expect(pushCalls).toHaveLength(0);
  });
});

describe("retryMessage — negative cases required by T-008", () => {
  it("an unknown message id is not-found", async () => {
    const { store } = createStore();
    const { line } = createLine();

    const result = await retryMessage("no-such-message", deps(store, line));

    expect(result.outcome).toBe("not-found");
  });

  it("retrying a message that is not failed is rejected as not-retryable", async () => {
    const sending = messageRow({
      id: "msg-sending",
      deliveryStatus: "sending",
    });
    const { store } = createStore({ existingMessage: sending });
    const { line } = createLine();

    const result = await retryMessage("msg-sending", deps(store, line));

    expect(result.outcome).toBe("not-retryable");
  });

  it("retrying an inbound message is rejected as not-retryable", async () => {
    const inbound = messageRow({
      id: "msg-inbound",
      direction: "inbound",
      deliveryStatus: null,
      clientId: null,
    });
    const { store } = createStore({ existingMessage: inbound });
    const { line } = createLine();

    const result = await retryMessage("msg-inbound", deps(store, line));

    expect(result.outcome).toBe("not-retryable");
  });

  it("a retry that fails again resolves failed, not thrown", async () => {
    const failed = messageRow({ id: "msg-failed", deliveryStatus: "failed" });
    const { store } = createStore({
      existingMessage: failed,
      unusedToken: null,
    });
    const { line } = createLine({ pushMessage: async () => false });

    const result = await retryMessage("msg-failed", deps(store, line));

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.message.deliveryStatus).toBe("failed");
  });
});
