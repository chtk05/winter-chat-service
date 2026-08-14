import { NextRequest } from "next/server";

import * as loginRoute from "@/app/api/auth/login/route";
import * as logoutRoute from "@/app/api/auth/logout/route";
import * as sessionRoute from "@/app/api/auth/session/route";
import { SESSION_COOKIE_NAME } from "@/lib/services/session";

/**
 * Route-handler tests: they prove the handlers answer per `openapi.yaml` — statuses,
 * cookie attributes, CORS headers. That the browser genuinely keeps the cookie across
 * origins is T-021's claim, and T-021 is blocked on OQ-22.
 */
const ACCESS_CODE = "CORRECT-ACCESS-CODE";
const SESSION_SECRET = "a-test-signing-secret-of-at-least-32-chars";
const WEB_ORIGIN = "http://localhost:3000";

const originalEnvironment = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnvironment,
    ACCESS_CODE,
    SESSION_SECRET,
    WEB_ORIGIN,
  };
});

afterAll(() => {
  process.env = originalEnvironment;
});

function loginRequest(
  body: unknown,
  init: { origin?: string | null } = {},
): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (init.origin !== null) {
    headers.set("origin", init.origin ?? WEB_ORIGIN);
  }

  return new NextRequest("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Parses the raw Set-Cookie header, which is where the D-029 attributes actually live. */
function setCookieHeader(response: Response): string {
  const header = response.headers.get("set-cookie");
  expect(header).not.toBeNull();
  return header as string;
}

describe("POST /api/auth/login — positive", () => {
  it("answers 204 with no body on the correct code", async () => {
    const response = await loginRoute.POST(loginRequest({ code: ACCESS_CODE }));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("sets the wc_session cookie with every attribute D-008 and D-029 require", async () => {
    const response = await loginRoute.POST(loginRequest({ code: ACCESS_CODE }));
    const cookie = setCookieHeader(response);

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    // D-029: Lax would never be sent on the cross-origin fetch from apps/web.
    expect(cookie).toContain("SameSite=none");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");
  });

  it("returns credentialed CORS headers for the allow-listed origin", async () => {
    const response = await loginRoute.POST(loginRequest({ code: ACCESS_CODE }));

    expect(response.headers.get("access-control-allow-origin")).toBe(
      WEB_ORIGIN,
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(response.headers.get("vary")).toBe("Origin");
  });
});

describe("POST /api/auth/login — negative", () => {
  it("answers 401 with the uniform D-021 body on a wrong code", async () => {
    const response = await loginRoute.POST(loginRequest({ code: "NOPE" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_ACCESS_CODE",
        message: "That access code didn't work.",
      },
    });
  });

  it("sets no cookie when the code is wrong", async () => {
    const response = await loginRoute.POST(loginRequest({ code: "NOPE" }));

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("answers an identical body for every wrong code (D-021)", async () => {
    const first = await (
      await loginRoute.POST(loginRequest({ code: "NOPE" }))
    ).json();
    const second = await (
      await loginRoute.POST(loginRequest({ code: "CORRECT-ACCESS-COD" }))
    ).json();

    // A near-miss must not be distinguishable from a wild guess.
    expect(first).toEqual(second);
  });

  it.each([
    ["an empty code", { code: "" }],
    ["a missing code", {}],
    ["a non-string code", { code: 1234 }],
  ])("answers 400 for %s", async (_label, body) => {
    const response = await loginRoute.POST(loginRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST" },
    });
  });

  it("answers 400 when the body is not JSON at all", async () => {
    const request = new NextRequest("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
        origin: WEB_ORIGIN,
      }),
      body: "this is not json",
    });

    expect((await loginRoute.POST(request)).status).toBe(400);
  });

  it("omits the allow-origin header for an origin outside the allow-list", async () => {
    const response = await loginRoute.POST(
      loginRequest(
        { code: ACCESS_CODE },
        { origin: "https://evil.example.com" },
      ),
    );

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("vary")).toBe("Origin");
  });

  it("answers 500 without leaking the reason when the environment is invalid", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    delete process.env.SESSION_SECRET;

    const response = await loginRoute.POST(loginRequest({ code: ACCESS_CODE }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: "SERVER_MISCONFIGURED",
        message: "The server is not configured correctly.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("SESSION_SECRET");
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});

describe("OPTIONS preflight", () => {
  it("answers 204 with the credentialed preflight headers", async () => {
    const request = new NextRequest("http://localhost:3001/api/auth/login", {
      method: "OPTIONS",
      headers: new Headers({ origin: WEB_ORIGIN }),
    });

    const response = loginRoute.OPTIONS(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      WEB_ORIGIN,
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
  });

  it("grants nothing to a disallowed origin", () => {
    const request = new NextRequest("http://localhost:3001/api/auth/login", {
      method: "OPTIONS",
      headers: new Headers({ origin: "https://evil.example.com" }),
    });

    const response = loginRoute.OPTIONS(request);

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  function logoutRequest(cookie?: string): NextRequest {
    const headers = new Headers({ origin: WEB_ORIGIN });
    if (cookie) {
      headers.set("cookie", cookie);
    }
    return new NextRequest("http://localhost:3001/api/auth/logout", {
      method: "POST",
      headers,
    });
  }

  it("answers 204 and expires the cookie", async () => {
    const response = logoutRoute.POST(
      logoutRequest(`${SESSION_COOKIE_NAME}=x`),
    );
    const cookie = setCookieHeader(response);

    expect(response.status).toBe(204);
    expect(cookie).toContain("Max-Age=0");
  });

  it("clears with the same attributes it was set with, or the browser keeps it", () => {
    const cookie = setCookieHeader(
      logoutRoute.POST(logoutRequest(`${SESSION_COOKIE_NAME}=x`)),
    );

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=none");
    expect(cookie).toContain("Path=/");
  });

  it("is idempotent — succeeds with no session present (openapi.yaml)", () => {
    const response = logoutRoute.POST(logoutRequest());

    expect(response.status).toBe(204);
  });
});

describe("GET /api/auth/session", () => {
  async function issuedCookie(): Promise<string> {
    const response = await loginRoute.POST(loginRequest({ code: ACCESS_CODE }));
    const cookie = setCookieHeader(response);
    return cookie.split(";")[0];
  }

  function sessionRequest(cookie?: string): NextRequest {
    const headers = new Headers({ origin: WEB_ORIGIN });
    if (cookie) {
      headers.set("cookie", cookie);
    }
    return new NextRequest("http://localhost:3001/api/auth/session", {
      method: "GET",
      headers,
    });
  }

  it("answers 200 with authenticated and an expiry for a valid cookie", async () => {
    const response = await sessionRoute.GET(
      sessionRequest(await issuedCookie()),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.authenticated).toBe(true);
    expect(Number.isNaN(Date.parse(body.expiresAt))).toBe(false);
  });

  it.each([
    ["no cookie", undefined],
    ["a malformed cookie", `${SESSION_COOKIE_NAME}=garbage`],
    [
      "a cookie with a tampered payload",
      `${SESSION_COOKIE_NAME}=eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.bad`,
    ],
  ])("answers 401 for %s", async (_label, cookie) => {
    const response = await sessionRoute.GET(sessionRequest(cookie));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejects a cookie signed with a rotated secret", async () => {
    const cookie = await issuedCookie();
    process.env.SESSION_SECRET = "a-rotated-secret-also-32-chars-long!!";

    // D-008: rotating the signing secret invalidates every live session at once.
    expect((await sessionRoute.GET(sessionRequest(cookie))).status).toBe(401);
  });
});
