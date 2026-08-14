import { SignJWT } from "jose";

import { fixedClock } from "@/lib/clock";
import { bearerToken, describeCaller } from "@/lib/services/session-state";

const SECRET = "a-test-signing-secret-of-at-least-32-chars";
const OTHER_DEPLOYMENT_SECRET = "a-different-signing-secret-32-chars-long!";
const NOW = new Date("2026-08-13T09:00:00.000Z");
const LINE_USER_ID = "U8f2c000000000000000000000000004471";
const TTL_SECONDS = 120;

const dependencies = {
  config: { sessionSecret: SECRET },
  clock: fixedClock(NOW),
};

async function mintToken(
  claims: Record<string, unknown> = {},
  secret = SECRET,
): Promise<string> {
  const issuedAtSeconds = Math.floor(NOW.getTime() / 1000);

  return new SignJWT({ sub: LINE_USER_ID, member: true, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + TTL_SECONDS)
    .sign(new TextEncoder().encode(secret));
}

describe("bearerToken", () => {
  it("extracts the token from a well-formed header", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("accepts the scheme in any case", () => {
    expect(bearerToken("bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("BEARER abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("tolerates surrounding whitespace and repeated spaces", () => {
    expect(bearerToken("  Bearer   abc.def.ghi  ")).toBe("abc.def.ghi");
  });

  it.each([
    ["an absent header", null],
    ["an empty header", ""],
    ["a bare token with no scheme", "abc.def.ghi"],
    ["a different scheme", "Basic abc.def.ghi"],
    ["a scheme with no token", "Bearer"],
    ["a scheme with only whitespace after it", "Bearer   "],
    ["two tokens", "Bearer abc.def.ghi extra"],
    ["a scheme that merely starts with Bearer", "BearerToken abc.def.ghi"],
  ])("yields no token for %s", (_label, header) => {
    expect(bearerToken(header)).toBeUndefined();
  });
});

describe("describeCaller — positive cases", () => {
  it("reports a joined member", async () => {
    const token = await mintToken();

    await expect(
      describeCaller(`Bearer ${token}`, dependencies),
    ).resolves.toEqual({
      authenticated: true,
      lineUserId: LINE_USER_ID,
      member: true,
      expiresAt: new Date(NOW.getTime() + TTL_SECONDS * 1000),
    });
  });

  it("reports authenticated-but-not-joined as its own state (D-036's third state)", async () => {
    const token = await mintToken({ member: false });

    await expect(
      describeCaller(`Bearer ${token}`, dependencies),
    ).resolves.toMatchObject({ authenticated: true, member: false });
  });
});

describe("describeCaller — negative cases", () => {
  it.each([
    ["no Authorization header", null],
    ["an empty Authorization header", ""],
    ["a header with no Bearer scheme", "abc.def.ghi"],
    ["a Bearer header carrying rubbish", "Bearer not-a-jwt"],
  ])("reports unauthenticated for %s", async (_label, header) => {
    await expect(describeCaller(header, dependencies)).resolves.toEqual({
      authenticated: false,
    });
  });

  it("reports unauthenticated for a token signed with a different secret (D-039 drift)", async () => {
    const token = await mintToken({}, OTHER_DEPLOYMENT_SECRET);

    await expect(
      describeCaller(`Bearer ${token}`, dependencies),
    ).resolves.toEqual({ authenticated: false });
  });

  it("reports unauthenticated for an expired token", async () => {
    const token = await mintToken();
    const afterExpiry = {
      config: { sessionSecret: SECRET },
      clock: fixedClock(new Date(NOW.getTime() + (TTL_SECONDS + 1) * 1000)),
    };

    await expect(
      describeCaller(`Bearer ${token}`, afterExpiry),
    ).resolves.toEqual({ authenticated: false });
  });
});
