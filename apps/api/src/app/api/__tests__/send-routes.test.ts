import { NextRequest } from "next/server";

import { POST as postMessage } from "@/app/api/conversations/[conversationId]/messages/route";
import { POST as postRetry } from "@/app/api/messages/[messageId]/retry/route";
import { getSendStore } from "@/lib/db/prisma";
import { createLineClient } from "@/lib/line/client";
import type { MessageRow } from "@/lib/services/chat-types";
import type { SendStore } from "@/lib/services/send";

jest.mock("@/lib/db/prisma", () => ({ getSendStore: jest.fn() }));
jest.mock("@/lib/line/client", () => ({ createLineClient: jest.fn() }));

const getSendStoreMock = getSendStore as jest.Mock;
const createLineClientMock = createLineClient as jest.Mock;

const CONVERSATION_ID = "conv-1";
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
    deliveryStatus: "sent",
    failureReason: null,
    sentVia: "push",
    createdAt: new Date("2026-08-13T09:00:00.000Z"),
    ...overrides,
  };
}

function fakeStore(overrides: Partial<SendStore> = {}): SendStore {
  return {
    async findConversationForSend(id) {
      return id === CONVERSATION_ID
        ? { id: CONVERSATION_ID, contactLineUserId: "U8f2c4471" }
        : null;
    },
    async findMessageByClientId() {
      return null;
    },
    async createSendingMessage(args) {
      return messageRow({ ...args, deliveryStatus: "sending" });
    },
    async findUnusedReplyToken() {
      return null;
    },
    async markReplyTokenUsed() {},
    async resolveMessage(args) {
      return messageRow(args);
    },
    async closeConversation() {},
    async findMessageById() {
      return null;
    },
    async markMessageSending(id) {
      return messageRow({ id, deliveryStatus: "sending", failureReason: null });
    },
    ...overrides,
  };
}

function postJson(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://api.test${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function messagesParams(conversationId = CONVERSATION_ID) {
  return { params: Promise.resolve({ conversationId }) };
}

function retryParams(messageId = "msg-1") {
  return { params: Promise.resolve({ messageId }) };
}

beforeEach(() => {
  process.env.LINE_CHANNEL_SECRET = "channel-secret";
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "channel-access-token";

  getSendStoreMock.mockReturnValue(fakeStore());
  createLineClientMock.mockReturnValue({
    async fetchProfile() {
      return null;
    },
    async fetchContent() {
      return null;
    },
    async replyMessage() {
      return true;
    },
    async pushMessage() {
      return true;
    },
    async replyImage() {
      return true;
    },
    async pushImage() {
      return true;
    },
  });
});

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.LINE_CHANNEL_SECRET;
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
});

describe("POST /conversations/{id}/messages", () => {
  it("202s with the resolved message on success", async () => {
    const response = await postMessage(
      postJson(`/api/conversations/${CONVERSATION_ID}/messages`, {
        text: "hello",
        clientId: CLIENT_ID,
      }),
      messagesParams(),
    );

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.deliveryStatus).toBe("sent");
  });

  it("400s on empty text", async () => {
    const response = await postMessage(
      postJson(`/api/conversations/${CONVERSATION_ID}/messages`, {
        text: "",
        clientId: CLIENT_ID,
      }),
      messagesParams(),
    );

    expect(response.status).toBe(400);
  });

  it("400s on a missing clientId", async () => {
    const response = await postMessage(
      postJson(`/api/conversations/${CONVERSATION_ID}/messages`, {
        text: "hello",
      }),
      messagesParams(),
    );

    expect(response.status).toBe(400);
  });

  it("400s on a malformed JSON body rather than throwing", async () => {
    const request = new NextRequest(
      `http://api.test/api/conversations/${CONVERSATION_ID}/messages`,
      { method: "POST", body: "{not json" },
    );

    const response = await postMessage(request, messagesParams());

    expect(response.status).toBe(400);
  });

  it("404s for an unknown conversation", async () => {
    const response = await postMessage(
      postJson(`/api/conversations/no-such-conv/messages`, {
        text: "hello",
        clientId: CLIENT_ID,
      }),
      messagesParams("no-such-conv"),
    );

    expect(response.status).toBe(404);
  });

  it("202s for an image send (D-058), text omitted", async () => {
    const response = await postMessage(
      postJson(`/api/conversations/${CONVERSATION_ID}/messages`, {
        mediaUrl: "https://storage.test/chat-media/outbound/x.jpg",
        clientId: CLIENT_ID,
      }),
      messagesParams(),
    );

    expect(response.status).toBe(202);
  });

  it("400s on a non-https mediaUrl", async () => {
    const response = await postMessage(
      postJson(`/api/conversations/${CONVERSATION_ID}/messages`, {
        mediaUrl: "http://insecure.test/x.jpg",
        clientId: CLIENT_ID,
      }),
      messagesParams(),
    );

    expect(response.status).toBe(400);
  });

  it("500s with SERVER_MISCONFIGURED when LINE env vars are absent, never LINE calls", async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;

    const response = await postMessage(
      postJson(`/api/conversations/${CONVERSATION_ID}/messages`, {
        text: "hello",
        clientId: CLIENT_ID,
      }),
      messagesParams(),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("SERVER_MISCONFIGURED");
    expect(createLineClientMock).not.toHaveBeenCalled();
  });
});

describe("POST /messages/{id}/retry", () => {
  it("202s with the resolved message when the message was failed", async () => {
    getSendStoreMock.mockReturnValue(
      fakeStore({
        async findMessageById(id) {
          return id === "msg-1"
            ? messageRow({ id, deliveryStatus: "failed", failureReason: "x" })
            : null;
        },
      }),
    );

    const response = await postRetry(
      new NextRequest("http://api.test/api/messages/msg-1/retry", {
        method: "POST",
      }),
      retryParams(),
    );

    expect(response.status).toBe(202);
  });

  it("404s for an unknown message id", async () => {
    const response = await postRetry(
      new NextRequest("http://api.test/api/messages/no-such-msg/retry", {
        method: "POST",
      }),
      retryParams("no-such-msg"),
    );

    expect(response.status).toBe(404);
  });

  it("409s when the message is not in a retryable state", async () => {
    getSendStoreMock.mockReturnValue(
      fakeStore({
        async findMessageById(id) {
          return id === "msg-1"
            ? messageRow({ id, deliveryStatus: "sent" })
            : null;
        },
      }),
    );

    const response = await postRetry(
      new NextRequest("http://api.test/api/messages/msg-1/retry", {
        method: "POST",
      }),
      retryParams(),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_RETRYABLE");
  });
});
