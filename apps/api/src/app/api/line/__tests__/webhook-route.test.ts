import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/line/webhook/route";
import { getWebhookStore } from "@/lib/db/prisma";

jest.mock("@/lib/db/prisma", () => ({ getWebhookStore: jest.fn() }));

const SECRET = "line-channel-secret";
const LINE_USER_ID = "U8f2c000000000000000000000000004471";

const getWebhookStoreMock = getWebhookStore as jest.Mock;

let stored: Array<{ messageType: string; text: string | null }>;
let seen: Set<string>;
let consoleWarn: jest.SpyInstance;
let consoleError: jest.SpyInstance;

beforeEach(() => {
  stored = [];
  seen = new Set();
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

  process.env.LINE_CHANNEL_SECRET = SECRET;
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "channel-access-token";

  getWebhookStoreMock.mockReturnValue({
    async recordEvent(id: string) {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    },
    async findContactByLineUserId() {
      return { id: "contact-1" };
    },
    async createContact() {
      return { id: "contact-1" };
    },
    async latestConversationForContact() {
      return { id: "conv-1", status: "Open" };
    },
    async createConversation() {
      return { id: "conv-1" };
    },
    async appendInboundMessage(args: {
      messageType: string;
      text: string | null;
    }) {
      stored.push({ messageType: args.messageType, text: args.text });
    },
    async saveReplyToken() {},
  });
});

afterEach(() => {
  jest.clearAllMocks();
  consoleWarn.mockRestore();
  consoleError.mockRestore();
  delete process.env.LINE_CHANNEL_SECRET;
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
});

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

function webhookRequest(body: string, signature: string | null): NextRequest {
  return new NextRequest("http://api.test/api/line/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature === null ? {} : { "x-line-signature": signature }),
    },
    body,
  });
}

const VALID_BODY = JSON.stringify({
  destination: "Uoa",
  events: [
    {
      type: "message",
      webhookEventId: "evt-1",
      replyToken: "rt-1",
      source: { type: "user", userId: LINE_USER_ID },
      message: { id: "m-1", type: "text", text: "hello" },
    },
  ],
});

describe("POST /api/line/webhook — D-012", () => {
  it("answers 200 promptly for a valid signed event, so LINE does not retry", async () => {
    const response = await POST(webhookRequest(VALID_BODY, sign(VALID_BODY)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: 1,
      duplicates: 0,
    });
    expect(stored).toEqual([{ messageType: "text", text: "hello" }]);
  });

  it("answers 200 for a duplicate, having written nothing", async () => {
    await POST(webhookRequest(VALID_BODY, sign(VALID_BODY)));
    const response = await POST(webhookRequest(VALID_BODY, sign(VALID_BODY)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: 0,
      duplicates: 1,
    });
    expect(stored).toHaveLength(1);
  });

  it("answers 401 for a missing signature, with nothing written", async () => {
    const response = await POST(webhookRequest(VALID_BODY, null));

    expect(response.status).toBe(401);
    expect(stored).toEqual([]);
  });

  it("answers 401 for a wrong signature, with nothing written", async () => {
    const response = await POST(
      webhookRequest(VALID_BODY, sign(VALID_BODY, "attacker-secret")),
    );

    expect(response.status).toBe(401);
    expect(stored).toEqual([]);
  });

  it("answers 401 for a tampered body carrying the original signature", async () => {
    const tampered = VALID_BODY.replace("hello", "injected");

    const response = await POST(webhookRequest(tampered, sign(VALID_BODY)));

    expect(response.status).toBe(401);
    expect(stored).toEqual([]);
  });

  it("answers 400 for a malformed payload", async () => {
    const raw = "this is not json";

    const response = await POST(webhookRequest(raw, sign(raw)));

    expect(response.status).toBe(400);
    expect(stored).toEqual([]);
  });

  it("verifies the RAW body — a re-serialised equivalent must not validate", async () => {
    const spaced = JSON.stringify(JSON.parse(VALID_BODY), null, 2);

    const response = await POST(webhookRequest(spaced, sign(VALID_BODY)));

    expect(response.status).toBe(401);
  });

  it("answers 500 without naming the variable when the channel secret is missing", async () => {
    delete process.env.LINE_CHANNEL_SECRET;

    const response = await POST(webhookRequest(VALID_BODY, sign(VALID_BODY)));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("LINE_CHANNEL_SECRET");
  });

  it("sets no cookie (D-039)", async () => {
    const response = await POST(webhookRequest(VALID_BODY, sign(VALID_BODY)));

    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
