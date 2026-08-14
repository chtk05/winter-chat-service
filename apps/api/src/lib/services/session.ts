import { jwtVerify } from "jose";

import type { Clock } from "@/lib/clock";

/**
 * D-041: `apps/web` mints a short-lived JWT (HS256 over the shared `SESSION_SECRET`) on
 * each proxied call; this module is the verifying half. `apps/api` takes no Auth.js
 * dependency — it knows only `jose` and the shared secret.
 *
 * This file previously issued a 7-day session cookie under D-002/D-008. D-039 removed
 * that outright: `apps/api` sets no cookies at all. The cryptography and the whole
 * negative-case suite survived; the payload and the lifetime did not.
 *
 * There is deliberately no `issue` half here. `apps/web` mints (T-027); `apps/api` only
 * verifies. Tests construct tokens with `jose` directly, which also keeps them honest —
 * they exercise a token built the way the other app builds it, not one round-tripped
 * through a helper this app shares with itself.
 */

/** jose enforces HS256's 256-bit minimum. Validated at config load, not at first call. */
export const MINIMUM_SESSION_SECRET_LENGTH = 32;

/**
 * D-050: `sub` is the LINE user id, not an internal `User.id` — `apps/web` cannot know a
 * cuid it never fetched. D-045: no role claim. This is the complete claim set.
 */
export interface ServiceTokenClaims {
  /** The LINE user id, resolved against `users.lineUserId` (D-050). */
  readonly lineUserId: string;
  /** D-036 membership. False for a LINE-authenticated user who has not joined. */
  readonly member: boolean;
}

/**
 * Why a union rather than a boolean: D-041 requires a malformed token, a bad signature and
 * an expired token to stay distinguishable as negative cases. Collapsing them to `false`
 * would make those tests indistinguishable, so the reason is part of the contract.
 *
 * A token signed with a *different* secret than this app holds — D-039's two-deployment
 * drift — surfaces as `bad-signature`, which is genuinely what it is.
 */
export type TokenRejectionReason = "malformed" | "bad-signature" | "expired";

export type TokenVerification =
  | {
      readonly valid: true;
      readonly claims: ServiceTokenClaims;
      readonly expiresAt: Date;
    }
  | { readonly valid: false; readonly reason: TokenRejectionReason };

export async function verifyServiceToken(
  token: string | undefined,
  secret: string,
  clock: Clock,
): Promise<TokenVerification> {
  if (!token) {
    return { valid: false, reason: "malformed" };
  }

  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), {
      // Pinned explicitly. Without this, a token declaring a different algorithm is a
      // downgrade attempt that jose would have to reject on its own terms; naming the one
      // algorithm we issue makes `alg: none` and algorithm confusion a parse failure.
      algorithms: ["HS256"],
      // Expiry is checked against the injected clock, not the process clock, so the
      // expired-token case is provable without waiting.
      currentDate: clock.now(),
    });

    if (typeof payload.exp !== "number") {
      // jose does not require `exp`. D-049 gives the token a 120s life, so a token
      // without one would never expire — refused rather than treated as long-lived.
      return { valid: false, reason: "malformed" };
    }

    const claims = readClaims(payload);

    if (!claims) {
      // Correctly signed but not shaped like our token. Refused rather than defaulted:
      // defaulting a missing `member` to `false` would be safe, but defaulting a missing
      // subject to anything would not, and one rule for both is easier to hold.
      return { valid: false, reason: "malformed" };
    }

    return { valid: true, claims, expiresAt: new Date(payload.exp * 1000) };
  } catch (error) {
    return { valid: false, reason: classifyVerificationFailure(error) };
  }
}

function readClaims(
  payload: Record<string, unknown>,
): ServiceTokenClaims | null {
  const subject = payload.sub;
  const member = payload.member;

  if (typeof subject !== "string" || subject.length === 0) {
    return null;
  }

  // Strictly boolean. A string "false" is truthy in JavaScript, and admitting one would
  // turn a serialisation slip in `apps/web` into a silent grant of membership.
  if (typeof member !== "boolean") {
    return null;
  }

  return { lineUserId: subject, member };
}

/**
 * A token signed with a rotated secret and a token whose payload was tampered with both
 * surface as the same jose failure — the signature no longer matches. They are reported
 * as one reason because they are genuinely one failure, not two.
 */
function classifyVerificationFailure(error: unknown): TokenRejectionReason {
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
