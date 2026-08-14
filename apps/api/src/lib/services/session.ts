import { jwtVerify } from "jose";

import type { Clock } from "@/lib/clock";

export const MINIMUM_SESSION_SECRET_LENGTH = 32;

export interface ServiceTokenClaims {
  readonly lineUserId: string;
  readonly member: boolean;
}

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
      algorithms: ["HS256"],
      currentDate: clock.now(),
    });

    if (typeof payload.exp !== "number") {
      return { valid: false, reason: "malformed" };
    }

    const claims = readClaims(payload);

    if (!claims) {
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

  if (typeof member !== "boolean") {
    return null;
  }

  return { lineUserId: subject, member };
}

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
