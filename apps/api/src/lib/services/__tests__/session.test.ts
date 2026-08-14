import { SignJWT } from "jose";

import { fixedClock } from "@/lib/clock";
import { verifyServiceToken } from "@/lib/services/session";

const SECRET = "a-test-signing-secret-of-at-least-32-chars";
const OTHER_DEPLOYMENT_SECRET = "a-different-signing-secret-32-chars-long!";
const NOW = new Date("2026-08-13T09:00:00.000Z");
const LINE_USER_ID = "U8f2c000000000000000000000000004471";

const TTL_SECONDS = 120;

function encode(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function mintToken(
  overrides: {
    secret?: string;
    claims?: Record<string, unknown>;
    issuedAt?: Date;
    expiresAt?: Date | null;
    algorithm?: string;
  } = {},
): Promise<string> {
  const issuedAt = overrides.issuedAt ?? NOW;
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);

  let builder = new SignJWT({
    sub: LINE_USER_ID,
    member: true,
    ...overrides.claims,
  })
    .setProtectedHeader({ alg: overrides.algorithm ?? "HS256" })
    .setIssuedAt(issuedAtSeconds);

  if (overrides.expiresAt !== null) {
    builder = builder.setExpirationTime(
      overrides.expiresAt
        ? Math.floor(overrides.expiresAt.getTime() / 1000)
        : issuedAtSeconds + TTL_SECONDS,
    );
  }

  return builder.sign(encode(overrides.secret ?? SECRET));
}

describe("verifyServiceToken — positive cases (D-041, D-050)", () => {
  it("accepts a token signed with the shared secret and returns its claims", async () => {
    const token = await mintToken();

    await expect(
      verifyServiceToken(token, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({
      valid: true,
      claims: { lineUserId: LINE_USER_ID, member: true },
      expiresAt: new Date(NOW.getTime() + TTL_SECONDS * 1000),
    });
  });

  it("carries `member: false` through rather than defaulting it (D-046)", async () => {
    const token = await mintToken({ claims: { member: false } });
    const result = await verifyServiceToken(token, SECRET, fixedClock(NOW));

    expect(result).toMatchObject({
      valid: true,
      claims: { lineUserId: LINE_USER_ID, member: false },
    });
  });

  it("accepts a token one second before it expires (boundary)", async () => {
    const token = await mintToken();
    const oneSecondEarly = new Date(NOW.getTime() + (TTL_SECONDS - 1) * 1000);

    await expect(
      verifyServiceToken(token, SECRET, fixedClock(oneSecondEarly)),
    ).resolves.toMatchObject({ valid: true });
  });

  it("resolves the subject as a LINE user id, not an internal User id (D-050)", async () => {
    const token = await mintToken({ claims: { sub: LINE_USER_ID } });
    const result = await verifyServiceToken(token, SECRET, fixedClock(NOW));

    expect(result).toMatchObject({ claims: { lineUserId: LINE_USER_ID } });
  });
});

describe("verifyServiceToken — negative cases required by D-041 and T-004", () => {
  it("rejects an absent token", async () => {
    await expect(
      verifyServiceToken(undefined, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects an empty token", async () => {
    await expect(
      verifyServiceToken("", SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects a malformed token", async () => {
    await expect(
      verifyServiceToken("not.a.jwt", SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects a tampered payload, keeping the original signature", async () => {
    const token = await mintToken({ claims: { member: false } });
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: LINE_USER_ID,
        member: true,
        exp: Math.floor(NOW.getTime() / 1000) + TTL_SECONDS,
      }),
      "utf8",
    ).toString("base64url");

    await expect(
      verifyServiceToken(
        `${header}.${forgedPayload}.${signature}`,
        SECRET,
        fixedClock(NOW),
      ),
    ).resolves.toEqual({ valid: false, reason: "bad-signature" });
  });

  it("rejects a token signed with a DIFFERENT secret than this app holds (D-039 drift)", async () => {
    const token = await mintToken({ secret: OTHER_DEPLOYMENT_SECRET });

    await expect(
      verifyServiceToken(token, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "bad-signature" });
  });

  it("rejects an expired token", async () => {
    const token = await mintToken();
    const afterExpiry = new Date(NOW.getTime() + (TTL_SECONDS + 1) * 1000);

    await expect(
      verifyServiceToken(token, SECRET, fixedClock(afterExpiry)),
    ).resolves.toEqual({ valid: false, reason: "expired" });
  });

  it("rejects an `alg: none` token", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none" }),
      "utf8",
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: LINE_USER_ID,
        member: true,
        exp: Math.floor(NOW.getTime() / 1000) + TTL_SECONDS,
      }),
      "utf8",
    ).toString("base64url");

    const result = await verifyServiceToken(
      `${header}.${payload}.`,
      SECRET,
      fixedClock(NOW),
    );

    expect(result.valid).toBe(false);
  });

  it("rejects a validly signed token carrying no `exp` (D-049 gives it 120s)", async () => {
    const token = await mintToken({ expiresAt: null });

    await expect(
      verifyServiceToken(token, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects a validly signed token with no subject", async () => {
    const token = await mintToken({ claims: { sub: undefined } });

    await expect(
      verifyServiceToken(token, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects a validly signed token with an empty subject", async () => {
    const token = await mintToken({ claims: { sub: "" } });

    await expect(
      verifyServiceToken(token, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects a validly signed token with no `member` claim", async () => {
    const token = await mintToken({ claims: { member: undefined } });

    await expect(
      verifyServiceToken(token, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it.each([
    ['the string "true"', "true"],
    ['the string "false"', "false"],
    ["the number 1", 1],
    ["null", null],
  ])(
    "rejects a `member` claim that is %s rather than a boolean",
    async (_label, member) => {
      const token = await mintToken({ claims: { member } });

      await expect(
        verifyServiceToken(token, SECRET, fixedClock(NOW)),
      ).resolves.toEqual({ valid: false, reason: "malformed" });
    },
  );
});
