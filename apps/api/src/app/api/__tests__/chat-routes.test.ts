import { NextRequest } from "next/server";

import { GET as getConversations } from "@/app/api/conversations/route";
import {
  GET as getConversation,
  PATCH as patchConversation,
} from "@/app/api/conversations/[conversationId]/route";
import { GET as getMessages } from "@/app/api/conversations/[conversationId]/messages/route";
import { POST as postRead } from "@/app/api/conversations/[conversationId]/read/route";
import { GET as getSummary } from "@/app/api/dashboard/summary/route";
import { GET as getSync } from "@/app/api/sync/route";
import {
  getConversationStore,
  getDashboardStore,
  getSyncStore,
  getThreadStore,
} from "@/lib/db/prisma";
import type { ConversationRow } from "@/lib/services/chat-types";

jest.mock("@/lib/db/prisma", () => ({
  getConversationStore: jest.fn(),
  getThreadStore: jest.fn(),
  getDashboardStore: jest.fn(),
  getSyncStore: jest.fn(),
}));

const conversationStoreMock = getConversationStore as jest.Mock;
const threadStoreMock = getThreadStore as jest.Mock;
const dashboardStoreMock = getDashboardStore as jest.Mock;
const syncStoreMock = getSyncStore as jest.Mock;

const CONVERSATION: ConversationRow = {
  id: "c-1",
  status: "Open",
  unread: true,
  lastMessageAt: new Date("2026-08-13T09:00:00.000Z"),
  contact: {
    id: "contact-1",
    lineUserId: "U8f2c4471",
    displayName: "Aom",
    avatarUrl: null,
    firstSeenAt: new Date("2026-08-01T00:00:00.000Z"),
  },
};

function params(conversationId = "c-1") {
  return { params: Promise.resolve({ conversationId }) };
}

function get(url: string): NextRequest {
  return new NextRequest(`http://api.test${url}`, { method: "GET" });
}

beforeEach(() => {
  conversationStoreMock.mockReturnValue({
    async listLatestPerContact() {
      return [{ conversation: CONVERSATION, snippet: "hello" }];
    },
    async countTotals() {
      return { matching: 1, all: 1, open: 1 };
    },
    async findById(id: string) {
      return id === "c-1" ? CONVERSATION : null;
    },
    async countMessages() {
      return 3;
    },
    async latestSnippet() {
      return "hello";
    },
    async updateStatus(id: string, status: ConversationRow["status"]) {
      return id === "c-1" ? { ...CONVERSATION, status } : null;
    },
    async markRead(id: string) {
      return id === "c-1";
    },
  });

  threadStoreMock.mockReturnValue({
    async conversationExists(id: string) {
      return id === "c-1";
    },
    async listMessagesDescending() {
      return [];
    },
  });

  dashboardStoreMock.mockReturnValue({
    async countContacts() {
      return 0;
    },
    async countUnreadContacts() {
      return 0;
    },
    async countActiveContactsSince() {
      return 0;
    },
    async listMessagesSince() {
      return [];
    },
    async listRecentActivity() {
      return [];
    },
  });

  syncStoreMock.mockReturnValue({
    async latestActivityAt() {
      return CONVERSATION.lastMessageAt;
    },
  });
});

afterEach(() => jest.clearAllMocks());

describe("GET /api/conversations", () => {
  it("answers 200 with items and totals", async () => {
    const response = await getConversations(get("/api/conversations"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ id: "c-1", channel: "LINE" }],
      totals: { matching: 1, all: 1, open: 1 },
    });
  });

  it("answers 400 for an unknown status filter", async () => {
    const response = await getConversations(
      get("/api/conversations?status=Archived"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST" },
    });
  });
});

describe("GET/PATCH /api/conversations/{id}", () => {
  it("answers 200 with the message count", async () => {
    const response = await getConversation(
      get("/api/conversations/c-1"),
      params(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "c-1",
      messageCount: 3,
    });
  });

  it("answers 404 for an unknown conversation", async () => {
    const response = await getConversation(
      get("/api/conversations/nope"),
      params("nope"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("answers 200 on a valid status change", async () => {
    const request = new NextRequest("http://api.test/api/conversations/c-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "Closed" }),
    });

    const response = await patchConversation(request, params());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "Closed" });
  });

  it("answers 400 for an invalid status", async () => {
    const request = new NextRequest("http://api.test/api/conversations/c-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "Archived" }),
    });

    expect((await patchConversation(request, params())).status).toBe(400);
  });

  it("answers 400 for a malformed body rather than throwing", async () => {
    const request = new NextRequest("http://api.test/api/conversations/c-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    expect((await patchConversation(request, params())).status).toBe(400);
  });
});

describe("POST /api/conversations/{id}/read", () => {
  it("answers 204 with no body", async () => {
    const response = await postRead(
      get("/api/conversations/c-1/read"),
      params(),
    );

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
  });

  it("is idempotent — a second call still answers 204", async () => {
    expect((await postRead(get("/x"), params())).status).toBe(204);
    expect((await postRead(get("/x"), params())).status).toBe(204);
  });

  it("answers 404 for an unknown conversation", async () => {
    const response = await postRead(get("/x"), params("nope"));

    expect(response.status).toBe(404);
  });
});

describe("GET /api/conversations/{id}/messages", () => {
  it("answers 200 with an empty page for a conversation with no messages", async () => {
    const response = await getMessages(
      get("/api/conversations/c-1/messages"),
      params(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  it("answers 400 for a limit above the D-026 maximum", async () => {
    const response = await getMessages(
      get("/api/conversations/c-1/messages?limit=51"),
      params(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST", message: expect.stringContaining("50") },
    });
  });

  it("answers 404 for an unknown conversation", async () => {
    const response = await getMessages(get("/x"), params("nope"));

    expect(response.status).toBe(404);
  });
});

describe("GET /api/dashboard/summary", () => {
  it("defaults to the `today` range", async () => {
    const response = await getSummary(get("/api/dashboard/summary"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      range: "today",
      timezone: "Asia/Bangkok",
    });
  });

  it("accepts the 7d range", async () => {
    const response = await getSummary(get("/api/dashboard/summary?range=7d"));

    await expect(response.json()).resolves.toMatchObject({ range: "7d" });
  });

  it("answers 400 for the design's 30d range, which D-020 puts out of scope", async () => {
    const response = await getSummary(get("/api/dashboard/summary?range=30d"));

    expect(response.status).toBe(400);
  });
});

describe("GET /api/sync", () => {
  it("answers the current watermark immediately when since is omitted", async () => {
    const response = await getSync(get("/api/sync"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      changed: false,
      at: CONVERSATION.lastMessageAt.toISOString(),
    });
  });

  it("answers changed when activity is newer than since", async () => {
    const response = await getSync(
      get("/api/sync?since=2026-08-13T08:00:00.000Z"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      changed: true,
      at: CONVERSATION.lastMessageAt.toISOString(),
    });
  });

  it("answers 400 for a malformed since timestamp", async () => {
    const response = await getSync(get("/api/sync?since=yesterday"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST" },
    });
  });
});

describe("D-039: no chat route sets a cookie", () => {
  it("emits no Set-Cookie header anywhere", async () => {
    const responses = [
      await getConversations(get("/api/conversations")),
      await getConversation(get("/x"), params()),
      await postRead(get("/x"), params()),
      await getMessages(get("/x"), params()),
      await getSummary(get("/api/dashboard/summary")),
      await getSync(get("/api/sync")),
    ];

    for (const response of responses) {
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
});
