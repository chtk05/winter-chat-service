import { SignJWT, jwtVerify } from "jose";

import type { Clock } from "@/lib/clock";

/** The cookie name is fixed by `openapi.yaml`'s `sessionCookie` security scheme. */
export const SESSION_COOKIE_NAME = "wc_session";

/** D-008: 7 days, expressed in seconds because both JWT `exp` and `Max-Age` want that. */
export const SESSION_LIFETIME_SECONDS = 604800;

/**
 * jose enforces HS256's 256-bit minimum key length. Validated at config load so a short
 * secret fails at startup with a clear message rather than at the first login attempt.
 */
export const MINIMUM_SESSION_SECRET_LENGTH = 32;

export interface IssuedSession {
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Why a union rather than a boolean: D-008 requires distinct negative cases for a
 * malformed cookie, a bad signature and an expired cookie. Collapsing them to `false`
 * would make those three tests indistinguishable, so the reason is part of the contract.
 */
export type SessionRejectionReason = "malformed" | "bad-signature" | "expired";

export type SessionVerification =
  | { readonly valid: true; readonly expiresAt: Date }
  | { readonly valid: false; readonly reason: SessionRejectionReason };

/**
 * D-008: a stateless signed session. There is no session table, so nothing is stored
 * server-side and there is no per-session revocation — rotating `SESSION_SECRET`
 * invalidates every live session at once, which is the recorded consequence.
 *
 * The payload is deliberately empty: D-002 creates no per-user identity, so there is no
 * subject to name. Holding a validly signed token *is* the entire claim.
 */
export async function issueSession(
  secret: string,
  clock: Clock,
): Promise<IssuedSession> {
  const issuedAtSeconds = Math.floor(clock.now().getTime() / 1000);
  const expiresAtSeconds = issuedAtSeconds + SESSION_LIFETIME_SECONDS;

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(encodeSecret(secret));

  return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
}

export async function verifySession(
  token: string | undefined,
  secret: string,
  clock: Clock,
): Promise<SessionVerification> {
  if (!token) {
    return { valid: false, reason: "malformed" };
  }

  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), {
      // Expiry is checked against the injected clock, not the process clock, so the
      // expired-cookie case is provable without waiting seven days.
      currentDate: clock.now(),
    });

    if (typeof payload.exp !== "number") {
      return { valid: false, reason: "malformed" };
    }

    return { valid: true, expiresAt: new Date(payload.exp * 1000) };
  } catch (error) {
    return { valid: false, reason: classifyVerificationFailure(error) };
  }
}

/**
 * A token signed with a rotated secret and a token whose payload was tampered with both
 * surface as the same jose failure — the signature no longer matches. They are reported
 * as one reason because they are genuinely one failure, not two.
 */
function classifyVerificationFailure(error: unknown): SessionRejectionReason {
  const code = errorCode(error);

  if (code === "ERR_JWT_EXPIRED") {
    return "expired";
  }

  if (code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") {
    return "bad-signature";
  }

  return "malformed";
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}
