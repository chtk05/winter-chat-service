import { SignJWT } from "jose";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/auth/join/route";
import { getMemberStore } from "@/lib/db/prisma";

jest.mock("@/lib/db/prisma", () => ({
  getMemberStore: jest.fn(),
}));

const ACCESS_CODE = "CORRECT-JOIN-CODE";
const SECRET = "a-test-signing-secret-of-at-least-32-chars";
const OTHER_DEPLOYMENT_SECRET = "a-different-signing-secret-32-chars-long!";
const LINE_USER_ID = "U8f2c000000000000000000000000004471";

const getMemberStoreMock = getMemberStore as jest.MockedFunction<
  typeof getMemberStore
>;

let granted: string[];

beforeEach(() => {
  granted = [];
  getMemberStoreMock.mockReturnValue({
    async grantMembership(lineUserId: string) {
      granted.push(lineUserId);
      return { alreadyMember: false };
    },
    async isMember() {
      return false;
    },
  });

  process.env.ACCESS_CODE = ACCESS_CODE;
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.ACCESS_CODE;
  delete process.env.SESSION_SECRET;
});

async function mintToken({
  member = false,
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

function joinRequest(token: string | null, body: unknown): NextRequest {
  return new NextRequest("http://api.test/api/auth/join", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/auth/join — positive cases", () => {
  it("accepts the correct code from a token whose `member` claim is false (D-046 bootstrap)", async () => {
    const response = await POST(
      joinRequest(await mintToken({ member: false }), { code: ACCESS_CODE }),
    );

    expect(response.status).toBe(204);
    expect(granted).toEqual([LINE_USER_ID]);
  });

  it("is idempotent for a caller who is already a member", async () => {
    getMemberStoreMock.mockReturnValue({
      async grantMembership() {
        return { alreadyMember: true };
      },
      async isMember() {
        return true;
      },
    });

    const response = await POST(
      joinRequest(await mintToken({ member: true }), { code: ACCESS_CODE }),
    );

    expect(response.status).toBe(204);
  });

  it("joins the token's subject, ignoring any id in the body", async () => {
    await POST(
      joinRequest(await mintToken(), {
        code: ACCESS_CODE,
        lineUserId: "Uattacker",
        sub: "Uattacker",
      }),
    );

    expect(granted).toEqual([LINE_USER_ID]);
  });
});

describe("POST /api/auth/join — negative cases required by T-004", () => {
  it("rejects a wrong code with 401 INVALID_ACCESS_CODE and grants nothing", async () => {
    const response = await POST(
      joinRequest(await mintToken(), { code: "WRONG" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_ACCESS_CODE",
        message: "That access code didn't work.",
      },
    });
    expect(granted).toEqual([]);
  });

  it("rejects an empty code with 400", async () => {
    const response = await POST(joinRequest(await mintToken(), { code: "" }));

    expect(response.status).toBe(400);
    expect(granted).toEqual([]);
  });

  it("rejects a missing code with 400", async () => {
    const response = await POST(joinRequest(await mintToken(), {}));

    expect(response.status).toBe(400);
  });

  it("rejects a malformed JSON body with 400 rather than throwing", async () => {
    const response = await POST(joinRequest(await mintToken(), "{not json"));

    expect(response.status).toBe(400);
    expect(granted).toEqual([]);
  });

  it("rejects a join attempt with no token at all", async () => {
    const response = await POST(joinRequest(null, { code: ACCESS_CODE }));

    expect(response.status).toBe(401);
    expect(granted).toEqual([]);
  });

  it("rejects a token signed with a different secret (D-039 drift)", async () => {
    const response = await POST(
      joinRequest(await mintToken({ secret: OTHER_DEPLOYMENT_SECRET }), {
        code: ACCESS_CODE,
      }),
    );

    expect(response.status).toBe(401);
    expect(granted).toEqual([]);
  });

  it("rejects an expired token", async () => {
    const response = await POST(
      joinRequest(
        await mintToken({
          issuedAt: new Date(Date.now() - 3600_000),
          lifetimeSeconds: 120,
        }),
        { code: ACCESS_CODE },
      ),
    );

    expect(response.status).toBe(401);
    expect(granted).toEqual([]);
  });

  it("answers 500 without naming the variable when the environment is broken", async () => {
    delete process.env.SESSION_SECRET;
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await POST(
      joinRequest("irrelevant", { code: ACCESS_CODE }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("SESSION_SECRET");

    consoleError.mockRestore();
  });
});

describe("D-039: apps/api sets no cookies anywhere", () => {
  it.each([
    ["a successful join", { code: ACCESS_CODE }, 204],
    ["a wrong code", { code: "WRONG" }, 401],
    ["an empty code", { code: "" }, 400],
  ])(
    "emits no Set-Cookie header on %s",
    async (_label, body, expectedStatus) => {
      const response = await POST(joinRequest(await mintToken(), body));

      expect(response.status).toBe(expectedStatus);
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );
});
