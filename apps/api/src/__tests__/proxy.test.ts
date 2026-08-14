import { SignJWT } from "jose";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

const SECRET = "a-test-signing-secret-of-at-least-32-chars";
const OTHER_DEPLOYMENT_SECRET = "a-different-signing-secret-32-chars-long!";
const ACCESS_CODE = "CORRECT-JOIN-CODE";
const LINE_USER_ID = "U8f2c000000000000000000000000004471";

beforeEach(() => {
  process.env.ACCESS_CODE = ACCESS_CODE;
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.ACCESS_CODE;
  delete process.env.SESSION_SECRET;
});

async function mintToken({
  member = true,
  secret = SECRET,
  lifetimeSeconds = 120,
  issuedAt = new Date(),
}: {
  member?: boolean;
  secret?: string;
  lifetimeSeconds?: number;
  issuedAt?: Date;
} = {}): Promise<string> {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);

  return new SignJWT({ sub: LINE_USER_ID, member })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + lifetimeSeconds)
    .sign(new TextEncoder().encode(secret));
}

function request(path: string, token?: string): NextRequest {
  return new NextRequest(`http://api.test${path}`, {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function passedThrough(response: { headers: Headers }): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

describe("proxy — positive cases (D-039, D-046)", () => {
  it("lets a member through to a protected route", async () => {
    const response = await proxy(
      request("/api/conversations", await mintToken({ member: true })),
    );

    expect(passedThrough(response)).toBe(true);
  });

  it("lets a non-member through to the join endpoint (D-046 bootstrap)", async () => {
    const response = await proxy(
      request("/api/auth/join", await mintToken({ member: false })),
    );

    expect(passedThrough(response)).toBe(true);
  });

  it("lets the LINE webhook through with no token at all (D-012)", async () => {
    const response = await proxy(request("/api/line/webhook"));

    expect(passedThrough(response)).toBe(true);
  });
});

describe("proxy — negative cases", () => {
  it("answers 401 when no Authorization header is present", async () => {
    const response = await proxy(request("/api/conversations"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it.each([
    ["a malformed token", "not-a-jwt"],
    ["an empty token", ""],
  ])("answers 401 for %s", async (_label, token) => {
    const response = await proxy(request("/api/conversations", token));

    expect(response.status).toBe(401);
  });

  it("answers 401 for a token signed with a different secret (D-039 drift)", async () => {
    const response = await proxy(
      request(
        "/api/conversations",
        await mintToken({ secret: OTHER_DEPLOYMENT_SECRET }),
      ),
    );

    expect(response.status).toBe(401);
  });

  it("answers 401 for an expired token", async () => {
    const response = await proxy(
      request(
        "/api/conversations",
        await mintToken({ issuedAt: new Date(Date.now() - 3600_000) }),
      ),
    );

    expect(response.status).toBe(401);
  });

  it("answers 403 NOT_A_MEMBER for a valid token whose `member` claim is false (D-036, D-051)", async () => {
    const response = await proxy(
      request("/api/conversations", await mintToken({ member: false })),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_A_MEMBER" },
    });
  });

  it("does not let a non-member reach any protected route, not just the one tested", async () => {
    const token = await mintToken({ member: false });

    for (const path of [
      "/api/conversations",
      "/api/conversations/abc/messages",
      "/api/dashboard/summary",
      "/api/messages/abc/retry",
    ]) {
      const response = await proxy(request(path, token));
      expect(response.status).toBe(403);
    }
  });

  it("refuses every request with 500 when the environment is broken", async () => {
    delete process.env.SESSION_SECRET;
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await proxy(request("/api/conversations", "irrelevant"));

    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });

  it("still lets the webhook through when the environment is broken", async () => {
    delete process.env.SESSION_SECRET;

    const response = await proxy(request("/api/line/webhook"));

    expect(passedThrough(response)).toBe(true);
  });
});

describe("D-039: proxy sets no cookies", () => {
  it.each([
    ["a 401", undefined],
    ["a 403", "member-false"],
  ])("emits no Set-Cookie header on %s", async (_label, kind) => {
    const token =
      kind === "member-false" ? await mintToken({ member: false }) : undefined;
    const response = await proxy(request("/api/conversations", token));

    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
