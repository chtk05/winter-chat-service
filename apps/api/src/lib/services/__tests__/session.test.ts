import { SignJWT } from "jose";

import { fixedClock } from "@/lib/clock";
import {
  SESSION_LIFETIME_SECONDS,
  issueSession,
  verifySession,
} from "@/lib/services/session";

const SECRET = "a-test-signing-secret-of-at-least-32-chars";
const ROTATED_SECRET = "a-different-signing-secret-32-chars-long!";
const NOW = new Date("2026-08-12T09:00:00.000Z");

function encode(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

describe("issueSession", () => {
  it("issues a token expiring exactly 7 days out (D-008)", async () => {
    const session = await issueSession(SECRET, fixedClock(NOW));

    expect(session.expiresAt.getTime() - NOW.getTime()).toBe(
      SESSION_LIFETIME_SECONDS * 1000,
    );
    expect(SESSION_LIFETIME_SECONDS).toBe(604800);
  });

  it("issues a token that verifies against the same secret", async () => {
    const clock = fixedClock(NOW);
    const { token } = await issueSession(SECRET, clock);

    await expect(verifySession(token, SECRET, clock)).resolves.toEqual({
      valid: true,
      expiresAt: new Date(NOW.getTime() + SESSION_LIFETIME_SECONDS * 1000),
    });
  });

  it("carries no per-user identity, because D-002 creates none", async () => {
    const { token } = await issueSession(SECRET, fixedClock(NOW));
    const [, payloadSegment] = token.split(".");
    const payload: unknown = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );

    // Only the registered time claims — no sub, no email, no role.
    expect(Object.keys(payload as object).sort()).toEqual(["exp", "iat"]);
  });
});

describe("verifySession — negative cases required by D-008", () => {
  it("rejects an absent cookie", async () => {
    await expect(
      verifySession(undefined, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects an empty cookie value", async () => {
    await expect(verifySession("", SECRET, fixedClock(NOW))).resolves.toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("rejects a malformed cookie that is not a JWT at all", async () => {
    await expect(
      verifySession("not-a-jwt", SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects a token whose payload was tampered with (bad signature)", async () => {
    const { token } = await issueSession(SECRET, fixedClock(NOW));
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ iat: 0, exp: 9999999999, admin: true }),
      "utf8",
    ).toString("base64url");

    const tampered = `${header}.${forgedPayload}.${signature}`;

    await expect(
      verifySession(tampered, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "bad-signature" });
  });

  it("rejects a cookie signed with a rotated secret", async () => {
    const { token } = await issueSession(ROTATED_SECRET, fixedClock(NOW));

    await expect(
      verifySession(token, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "bad-signature" });
  });

  it("rejects an expired cookie", async () => {
    const { token } = await issueSession(SECRET, fixedClock(NOW));
    const oneSecondAfterExpiry = new Date(
      NOW.getTime() + (SESSION_LIFETIME_SECONDS + 1) * 1000,
    );

    await expect(
      verifySession(token, SECRET, fixedClock(oneSecondAfterExpiry)),
    ).resolves.toEqual({ valid: false, reason: "expired" });
  });

  it("still accepts a cookie one second before it expires (boundary)", async () => {
    const { token } = await issueSession(SECRET, fixedClock(NOW));
    const justBeforeExpiry = new Date(
      NOW.getTime() + (SESSION_LIFETIME_SECONDS - 1) * 1000,
    );

    const verification = await verifySession(
      token,
      SECRET,
      fixedClock(justBeforeExpiry),
    );

    expect(verification.valid).toBe(true);
  });

  it("rejects a validly signed token that carries no expiry", async () => {
    // A caller could otherwise mint a session that never dies, defeating D-008's 7 days.
    const noExpiry = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(NOW.getTime() / 1000))
      .sign(encode(SECRET));

    await expect(
      verifySession(noExpiry, SECRET, fixedClock(NOW)),
    ).resolves.toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects a token using the 'none' algorithm", async () => {
    const unsigned = `${Buffer.from(
      JSON.stringify({ alg: "none" }),
      "utf8",
    ).toString("base64url")}.${Buffer.from(
      JSON.stringify({ exp: 9999999999 }),
      "utf8",
    ).toString("base64url")}.`;

    const verification = await verifySession(unsigned, SECRET, fixedClock(NOW));

    expect(verification.valid).toBe(false);
  });
});
