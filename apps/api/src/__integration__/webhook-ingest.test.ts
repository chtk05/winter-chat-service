import { createHmac } from "node:crypto";
import { Client } from "pg";
import { config as loadEnvFile } from "dotenv";

const REPO_ROOT = `${__dirname}/../../../../`;

loadEnvFile({ path: `${REPO_ROOT}apps/api/.env`, quiet: true });

const API_ORIGIN = process.env.E2E_API_ORIGIN ?? "http://localhost:3001";
const WEBHOOK_URL = `${API_ORIGIN}/api/line/webhook`;

const CONTACT_TAG = "e2e-contact-";
const EVENT_TAG = "e2e-event-";

const run = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let client: Client;

function channelSecret(): string {
  const secret = process.env.LINE_CHANNEL_SECRET;

  if (!secret) {
    throw new Error(
      "LINE_CHANNEL_SECRET is not set — fill apps/api/.env from .env.example (D-012).",
    );
  }

  return secret;
}

function sign(rawBody: string): string {
  return createHmac("sha256", channelSecret()).update(rawBody).digest("base64");
}

function messageEvent(args: {
  eventId: string;
  lineUserId: string;
  type?: string;
  text?: string;
  replyToken?: string;
}): string {
  return JSON.stringify({
    destination: "Uffffffffffffffffffffffffffffffff",
    events: [
      {
        type: "message",
        webhookEventId: args.eventId,
        timestamp: Date.now(),
        source: { type: "user", userId: args.lineUserId },
        replyToken: args.replyToken ?? `reply-${args.eventId}`,
        message: {
          id: `msg-${args.eventId}`,
          type: args.type ?? "text",
          ...(args.text === undefined ? {} : { text: args.text }),
        },
      },
    ],
  });
}

async function postWebhook(
  rawBody: string,
  signature: string | null,
): Promise<Response> {
  return fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature === null ? {} : { "x-line-signature": signature }),
    },
    body: rawBody,
  });
}

async function cleanup(): Promise<void> {
  await client.query(`DELETE FROM contacts WHERE "lineUserId" LIKE $1`, [
    `${CONTACT_TAG}%`,
  ]);
  await client.query(`DELETE FROM webhook_events WHERE "lineEventId" LIKE $1`, [
    `${EVENT_TAG}%`,
  ]);
}

async function messagesFor(lineUserId: string) {
  const result = await client.query<{
    direction: string;
    messageType: string;
    text: string | null;
  }>(
    `SELECT m.direction, m."messageType", m.text
       FROM messages m
       JOIN conversations c ON c.id = m."conversationId"
       JOIN contacts ct ON ct.id = c."contactId"
      WHERE ct."lineUserId" = $1
      ORDER BY m."createdAt"`,
    [lineUserId],
  );

  return result.rows;
}

async function conversationFor(lineUserId: string) {
  const result = await client.query<{
    id: string;
    status: string;
    unread: boolean;
  }>(
    `SELECT c.id, c.status, c.unread
       FROM conversations c
       JOIN contacts ct ON ct.id = c."contactId"
      WHERE ct."lineUserId" = $1`,
    [lineUserId],
  );

  return result.rows[0] ?? null;
}

beforeAll(async () => {
  const connectionString = process.env.DIRECT_URL;

  if (!connectionString) {
    throw new Error(
      "DIRECT_URL is not set — phase 3 needs the real database (D-056).",
    );
  }

  client = new Client({ connectionString, connectionTimeoutMillis: 15_000 });
  await client.connect();
  await cleanup();

  const probe = await postWebhook(
    JSON.stringify({ events: [] }),
    "not-a-signature",
  );
  if (probe.status !== 401) {
    throw new Error(
      `apps/api is not answering as expected at ${WEBHOOK_URL} ` +
        `(got ${probe.status}, expected 401 for a bad signature). Is it running?`,
    );
  }
});

afterAll(async () => {
  if (client) {
    await cleanup();
    await client.end();
  }
});

describe("T-022 (database half): a signed webhook reaches the database", () => {
  it("stores an inbound text message, its contact and its conversation", async () => {
    const lineUserId = `${CONTACT_TAG}text-${run}`;
    const eventId = `${EVENT_TAG}text-${run}`;
    const body = messageEvent({
      eventId,
      lineUserId,
      text: "Is the walnut desk lamp back in stock?",
    });

    const response = await postWebhook(body, sign(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: 1,
      duplicates: 0,
    });

    const messages = await messagesFor(lineUserId);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      direction: "inbound",
      messageType: "text",
      text: "Is the walnut desk lamp back in stock?",
    });

    const conversation = await conversationFor(lineUserId);
    expect(conversation).toMatchObject({ status: "Open", unread: true });
  });

  it("falls back to the LINE user id as the display name when the profile is unavailable (D-013)", async () => {
    const lineUserId = `${CONTACT_TAG}profile-${run}`;
    const eventId = `${EVENT_TAG}profile-${run}`;
    const body = messageEvent({ eventId, lineUserId, text: "hello" });

    await postWebhook(body, sign(body));

    const contact = await client.query<{ displayName: string }>(
      `SELECT "displayName" FROM contacts WHERE "lineUserId" = $1`,
      [lineUserId],
    );

    expect(contact.rows[0].displayName).toBe(lineUserId);
  });

  it("stores a non-text message as a typed placeholder with no text (D-010)", async () => {
    const lineUserId = `${CONTACT_TAG}sticker-${run}`;
    const eventId = `${EVENT_TAG}sticker-${run}`;
    const body = messageEvent({ eventId, lineUserId, type: "sticker" });

    const response = await postWebhook(body, sign(body));
    expect(response.status).toBe(200);

    const messages = await messagesFor(lineUserId);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ messageType: "sticker", text: null });
  });

  it("keeps the reply token D-006's send path will need", async () => {
    const lineUserId = `${CONTACT_TAG}token-${run}`;
    const eventId = `${EVENT_TAG}token-${run}`;
    const replyToken = `reply-token-${run}`;
    const body = messageEvent({
      eventId,
      lineUserId,
      text: "hi",
      replyToken,
    });

    await postWebhook(body, sign(body));

    const tokens = await client.query<{ value: string; used: boolean }>(
      `SELECT rt.value, rt.used
         FROM reply_tokens rt
         JOIN conversations c ON c.id = rt."conversationId"
         JOIN contacts ct ON ct.id = c."contactId"
        WHERE ct."lineUserId" = $1`,
      [lineUserId],
    );

    expect(tokens.rows).toHaveLength(1);
    expect(tokens.rows[0]).toMatchObject({ value: replyToken, used: false });
  });

  it("reopens a Closed conversation as Pending rather than starting a new thread (D-047, D-048)", async () => {
    const lineUserId = `${CONTACT_TAG}reopen-${run}`;
    const first = messageEvent({
      eventId: `${EVENT_TAG}reopen-1-${run}`,
      lineUserId,
      text: "first",
    });

    await postWebhook(first, sign(first));

    const opened = await conversationFor(lineUserId);
    expect(opened?.status).toBe("Open");

    await client.query(
      `UPDATE conversations SET status = 'Closed' WHERE id = $1`,
      [opened!.id],
    );

    const second = messageEvent({
      eventId: `${EVENT_TAG}reopen-2-${run}`,
      lineUserId,
      text: "second",
    });
    await postWebhook(second, sign(second));

    const reopened = await conversationFor(lineUserId);
    expect(reopened?.id).toBe(opened!.id);
    expect(reopened?.status).toBe("Pending");
    expect(await messagesFor(lineUserId)).toHaveLength(2);
  });
});

describe("T-022 (database half): negative cases", () => {
  it("rejects an invalid signature with 401 and writes nothing", async () => {
    const lineUserId = `${CONTACT_TAG}badsig-${run}`;
    const body = messageEvent({
      eventId: `${EVENT_TAG}badsig-${run}`,
      lineUserId,
      text: "should never be stored",
    });

    const response = await postWebhook(
      body,
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });

    expect(await messagesFor(lineUserId)).toHaveLength(0);
    const events = await client.query(
      `SELECT 1 FROM webhook_events WHERE "lineEventId" = $1`,
      [`${EVENT_TAG}badsig-${run}`],
    );
    expect(events.rowCount).toBe(0);
  });

  it("rejects a MISSING signature header outright", async () => {
    const lineUserId = `${CONTACT_TAG}nosig-${run}`;
    const body = messageEvent({
      eventId: `${EVENT_TAG}nosig-${run}`,
      lineUserId,
      text: "unsigned",
    });

    const response = await postWebhook(body, null);

    expect(response.status).toBe(401);
    expect(await messagesFor(lineUserId)).toHaveLength(0);
  });

  it("rejects a body whose signature was computed over DIFFERENT bytes", async () => {
    const lineUserId = `${CONTACT_TAG}swapped-${run}`;
    const signed = messageEvent({
      eventId: `${EVENT_TAG}swapped-a-${run}`,
      lineUserId,
      text: "original",
    });
    const sent = messageEvent({
      eventId: `${EVENT_TAG}swapped-b-${run}`,
      lineUserId,
      text: "tampered",
    });

    const response = await postWebhook(sent, sign(signed));

    expect(response.status).toBe(401);
    expect(await messagesFor(lineUserId)).toHaveLength(0);
  });

  it("dedupes a redelivered event — one message, not two (D-012)", async () => {
    const lineUserId = `${CONTACT_TAG}dupe-${run}`;
    const eventId = `${EVENT_TAG}dupe-${run}`;
    const body = messageEvent({ eventId, lineUserId, text: "sent twice" });
    const signature = sign(body);

    const first = await postWebhook(body, signature);
    const second = await postWebhook(body, signature);

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ accepted: 1, duplicates: 0 });

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      accepted: 0,
      duplicates: 1,
    });

    expect(await messagesFor(lineUserId)).toHaveLength(1);
  });

  it("dedupes CONCURRENT redeliveries — the unique constraint, not a prior read", async () => {
    const lineUserId = `${CONTACT_TAG}race-${run}`;
    const eventId = `${EVENT_TAG}race-${run}`;
    const body = messageEvent({ eventId, lineUserId, text: "raced" });
    const signature = sign(body);

    const responses = await Promise.all([
      postWebhook(body, signature),
      postWebhook(body, signature),
      postWebhook(body, signature),
    ]);

    expect(responses.every((response) => response.status < 600)).toBe(true);

    expect(await messagesFor(lineUserId)).toHaveLength(1);
  });

  it("answers 400 for a malformed payload, without retry-inducing 5xx", async () => {
    const body = "this is not json";

    const response = await postWebhook(body, sign(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST" },
    });
  });

  it("drops a non-message event instead of failing the batch", async () => {
    const body = JSON.stringify({
      destination: "Uffffffffffffffffffffffffffffffff",
      events: [
        {
          type: "follow",
          webhookEventId: `${EVENT_TAG}follow-${run}`,
          timestamp: Date.now(),
          source: { type: "user", userId: `${CONTACT_TAG}follow-${run}` },
        },
      ],
    });

    const response = await postWebhook(body, sign(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: 0,
      duplicates: 0,
    });
    expect(await messagesFor(`${CONTACT_TAG}follow-${run}`)).toHaveLength(0);
  });

  it("is reachable with NO token at all — LINE calls it directly (D-012, D-040)", async () => {
    const lineUserId = `${CONTACT_TAG}notoken-${run}`;
    const eventId = `${EVENT_TAG}notoken-${run}`;
    const body = messageEvent({ eventId, lineUserId, text: "no bearer here" });

    const response = await postWebhook(body, sign(body));

    expect(response.status).toBe(200);
    expect(await messagesFor(lineUserId)).toHaveLength(1);
  });
});
