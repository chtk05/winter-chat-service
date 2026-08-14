import { readFileSync } from "node:fs";
import { join } from "node:path";

import { jwtVerify } from "jose";

import {
  SERVICE_TOKEN_TTL_SECONDS,
  mintServiceToken,
  readApiOrigin,
  readSessionSecret,
} from "@/lib/auth/service-token";

const SECRET = "a-test-signing-secret-of-at-least-32-chars";
const NOW = new Date("2026-08-13T09:00:00.000Z");
const LINE_USER_ID = "U8f2c000000000000000000000000004471";

describe("mintServiceToken — D-041, D-049, D-050", () => {
  it("mints a token apps/api's verifier accepts", async () => {
    const token = await mintServiceToken(
      { lineUserId: LINE_USER_ID, member: true },
      SECRET,
      NOW,
    );

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(SECRET),
      { algorithms: ["HS256"], currentDate: NOW },
    );

    expect(payload.sub).toBe(LINE_USER_ID);
    expect(payload.member).toBe(true);
  });

  it("carries EXACTLY the claim set apps/api reads — no role (D-045)", async () => {
    const token = await mintServiceToken(
      { lineUserId: LINE_USER_ID, member: false },
      SECRET,
      NOW,
    );
    const [, payloadSegment] = token.split(".");
    const payload: unknown = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );

    expect(Object.keys(payload as object).sort()).toEqual([
      "exp",
      "iat",
      "member",
      "sub",
    ]);
  });

  it("signs HS256, which is the only algorithm apps/api accepts", async () => {
    const token = await mintServiceToken(
      { lineUserId: LINE_USER_ID, member: true },
      SECRET,
      NOW,
    );
    const [headerSegment] = token.split(".");
    const header: unknown = JSON.parse(
      Buffer.from(headerSegment, "base64url").toString("utf8"),
    );

    expect((header as { alg: string }).alg).toBe("HS256");
  });

  it("expires 120 seconds out (D-049)", async () => {
    const token = await mintServiceToken(
      { lineUserId: LINE_USER_ID, member: true },
      SECRET,
      NOW,
    );
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(SECRET),
      { currentDate: NOW },
    );

    expect(payload.exp! - payload.iat!).toBe(SERVICE_TOKEN_TTL_SECONDS);
    expect(SERVICE_TOKEN_TTL_SECONDS).toBe(120);
  });

  it("is NOT the 7-day browser session lifetime (D-041 warns about conflating them)", () => {
    expect(SERVICE_TOKEN_TTL_SECONDS).not.toBe(604800);
  });

  it("carries `member: false` through rather than dropping the claim", async () => {
    const token = await mintServiceToken(
      { lineUserId: LINE_USER_ID, member: false },
      SECRET,
      NOW,
    );
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(SECRET),
      { currentDate: NOW },
    );

    expect(payload.member).toBe(false);
  });

  it("mints a fresh token per call, not a reused one", async () => {
    const later = new Date(NOW.getTime() + 60_000);

    const first = await mintServiceToken(
      { lineUserId: LINE_USER_ID, member: true },
      SECRET,
      NOW,
    );
    const second = await mintServiceToken(
      { lineUserId: LINE_USER_ID, member: true },
      SECRET,
      later,
    );

    expect(first).not.toBe(second);
  });

  it("mints a token that is expired past its TTL", async () => {
    const token = await mintServiceToken(
      { lineUserId: LINE_USER_ID, member: true },
      SECRET,
      NOW,
    );
    const past = new Date(
      NOW.getTime() + (SERVICE_TOKEN_TTL_SECONDS + 1) * 1000,
    );

    await expect(
      jwtVerify(token, new TextEncoder().encode(SECRET), { currentDate: past }),
    ).rejects.toThrow();
  });
});

describe("readSessionSecret — fails loudly at the boundary", () => {
  it("returns a valid secret", () => {
    expect(readSessionSecret({ SESSION_SECRET: SECRET })).toBe(SECRET);
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["shorter than HS256's 256-bit minimum", "too-short"],
  ])("throws when SESSION_SECRET is %s", (_label, value) => {
    expect(() => readSessionSecret({ SESSION_SECRET: value })).toThrow(
      /SESSION_SECRET/,
    );
  });
});

describe("readApiOrigin — D-025, D-040", () => {
  it("reads API_ORIGIN", () => {
    expect(readApiOrigin({ API_ORIGIN: "https://api.example.com" })).toBe(
      "https://api.example.com",
    );
  });

  it("is NOT a NEXT_PUBLIC_ variable — the browser must never learn the API origin", () => {
    const source = readFileSync(join(__dirname, "../service-token.ts"), "utf8");

    expect(source).not.toContain("NEXT_PUBLIC_");
  });
});
