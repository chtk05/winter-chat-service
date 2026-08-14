import { jwtVerify } from "jose";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/gateway/[...path]/route";
import { auth } from "@/auth";

jest.mock("@/auth", () => ({ auth: jest.fn() }));

const SECRET = "a-test-signing-secret-of-at-least-32-chars";
const LINE_USER_ID = "U8f2c000000000000000000000000004471";

const authMock = auth as unknown as jest.Mock;

let fetchMock: jest.Mock;
let consoleError: jest.SpyInstance;

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  process.env.API_ORIGIN = "http://api.test";

  authMock.mockResolvedValue({ lineUserId: LINE_USER_ID, member: true });

  fetchMock = jest.fn(
    async () =>
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;

  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
  consoleError.mockRestore();
  delete process.env.SESSION_SECRET;
  delete process.env.API_ORIGIN;
});

function params(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

function request(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): NextRequest {
  return new NextRequest(`http://web.test${url}`, {
    method: init.method ?? "GET",
    headers: init.headers,
    ...(init.body === undefined ? {} : { body: init.body }),
  });
}

function upstreamCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
  return { url: url.toString(), init };
}

describe("gateway proxy — positive cases (T-027, D-040, D-041, D-042)", () => {
  it("maps /gateway/<path> to <API_ORIGIN>/api/<path> (D-042)", async () => {
    await GET(request("/gateway/conversations"), params(["conversations"]));

    expect(upstreamCall().url).toBe("http://api.test/api/conversations");
  });

  it("maps a nested path", async () => {
    await GET(
      request("/gateway/conversations/c-1/messages"),
      params(["conversations", "c-1", "messages"]),
    );

    expect(upstreamCall().url).toBe(
      "http://api.test/api/conversations/c-1/messages",
    );
  });

  it("attaches a valid Bearer token apps/api can verify", async () => {
    await GET(request("/gateway/conversations"), params(["conversations"]));

    const authorization = new Headers(
      upstreamCall().init.headers as Headers,
    ).get("authorization");

    expect(authorization).toMatch(/^Bearer /);

    const { payload } = await jwtVerify(
      authorization!.slice("Bearer ".length),
      new TextEncoder().encode(SECRET),
      { algorithms: ["HS256"] },
    );

    expect(payload.sub).toBe(LINE_USER_ID);
    expect(payload.member).toBe(true);
  });

  it("carries the caller's `member: false` through rather than upgrading it", async () => {
    authMock.mockResolvedValue({ lineUserId: LINE_USER_ID, member: false });

    await POST(
      request("/gateway/auth/join", { method: "POST", body: '{"code":"X"}' }),
      params(["auth", "join"]),
    );

    const authorization = new Headers(
      upstreamCall().init.headers as Headers,
    ).get("authorization")!;
    const { payload } = await jwtVerify(
      authorization.slice("Bearer ".length),
      new TextEncoder().encode(SECRET),
    );

    expect(payload.member).toBe(false);
  });

  it("preserves the query string, which carries the list filter and search", async () => {
    await GET(
      request("/gateway/conversations?status=Open&search=refund"),
      params(["conversations"]),
    );

    expect(upstreamCall().url).toBe(
      "http://api.test/api/conversations?status=Open&search=refund",
    );
  });

  it("forwards the request body on POST", async () => {
    await POST(
      request("/gateway/auth/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"code":"WC-2026"}',
      }),
      params(["auth", "join"]),
    );

    const forwarded = new TextDecoder().decode(
      upstreamCall().init.body as ArrayBuffer,
    );
    expect(forwarded).toBe('{"code":"WC-2026"}');
    expect(upstreamCall().init.method).toBe("POST");
  });

  it("forwards a binary body byte-for-byte, unchanged by text decoding (D-058)", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    const binaryRequest = new NextRequest("http://web.test/gateway/uploads", {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body: bytes,
    });

    await POST(binaryRequest, params(["uploads"]));

    const forwarded = new Uint8Array(upstreamCall().init.body as ArrayBuffer);
    expect(Array.from(forwarded)).toEqual(Array.from(bytes));
  });

  it("returns the upstream status and body UNCHANGED, so D-021's error shape survives", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "INVALID_ACCESS_CODE",
            message: "That access code didn't work.",
          },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );

    const response = await POST(
      request("/gateway/auth/join", { method: "POST", body: "{}" }),
      params(["auth", "join"]),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_ACCESS_CODE",
        message: "That access code didn't work.",
      },
    });
  });

  it("relays a 403 NOT_A_MEMBER unchanged (D-051 — the console routes on it)", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "NOT_A_MEMBER", message: "Enter your join code." },
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    );

    const response = await GET(
      request("/gateway/conversations"),
      params(["conversations"]),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_A_MEMBER" },
    });
  });

  it("relays a 204 with no body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await POST(
      request("/gateway/conversations/c-1/read", { method: "POST" }),
      params(["conversations", "c-1", "read"]),
    );

    expect(response.status).toBe(204);
  });
});

describe("gateway proxy — negative cases required by T-027", () => {
  it("REFUSES a request with no session and never forwards it", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      request("/gateway/conversations"),
      params(["conversations"]),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a session carrying no LINE identity", async () => {
    authMock.mockResolvedValue({ lineUserId: null, member: false });

    const response = await GET(
      request("/gateway/conversations"),
      params(["conversations"]),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does NOT forward the browser's cookies upstream", async () => {
    await GET(
      request("/gateway/conversations", {
        headers: { cookie: "authjs.session-token=secret-value; other=1" },
      }),
      params(["conversations"]),
    );

    const headers = new Headers(upstreamCall().init.headers as Headers);

    expect(headers.get("cookie")).toBeNull();
    expect(JSON.stringify([...headers])).not.toContain("secret-value");
  });

  it("does NOT let the caller supply their own Authorization header", async () => {
    await GET(
      request("/gateway/conversations", {
        headers: { authorization: "Bearer forged-token" },
      }),
      params(["conversations"]),
    );

    const authorization = new Headers(
      upstreamCall().init.headers as Headers,
    ).get("authorization")!;

    expect(authorization).not.toContain("forged-token");
    await expect(
      jwtVerify(
        authorization.slice("Bearer ".length),
        new TextEncoder().encode(SECRET),
      ),
    ).resolves.toBeDefined();
  });

  it("answers 502 when the upstream is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await GET(
      request("/gateway/conversations"),
      params(["conversations"]),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UPSTREAM_UNAVAILABLE" },
    });
  });

  it("relays an upstream 5xx rather than masking it", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "X", message: "y" } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await GET(
      request("/gateway/conversations"),
      params(["conversations"]),
    );

    expect(response.status).toBe(500);
  });

  it("answers 500 without forwarding when SESSION_SECRET is missing", async () => {
    delete process.env.SESSION_SECRET;

    const response = await GET(
      request("/gateway/conversations"),
      params(["conversations"]),
    );

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SERVER_MISCONFIGURED" },
    });
  });

  it("never relays a Set-Cookie from upstream into the browser", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: {
          "set-cookie": "wc_session=stale",
          "content-type": "application/json",
        },
      }),
    );

    const response = await GET(
      request("/gateway/conversations"),
      params(["conversations"]),
    );

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("strips content-encoding and content-length, which describe the upstream bytes", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "NOT_A_MEMBER" } }), {
        status: 403,
        headers: {
          "content-type": "application/json",
          "content-encoding": "gzip",
          "content-length": "1234",
        },
      }),
    );

    const response = await GET(
      request("/gateway/conversations"),
      params(["conversations"]),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("mints a token per call rather than reusing one", async () => {
    await GET(request("/gateway/conversations"), params(["conversations"]));
    await GET(request("/gateway/conversations"), params(["conversations"]));

    const tokens = fetchMock.mock.calls.map((call) =>
      new Headers((call[1] as RequestInit).headers as Headers).get(
        "authorization",
      ),
    );

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatch(/^Bearer /);
    expect(tokens[1]).toMatch(/^Bearer /);
  });
});
