import { SignJWT } from "jose";

/**
 * D-041: `apps/web` mints a short-lived JWT per call to `apps/api`, signed HS256 over the
 * shared `SESSION_SECRET`. `apps/api` verifies it with `jose` and takes no Auth.js
 * dependency. Auth.js's own encrypted token never leaves this app.
 *
 * This is the MINTING half. `apps/api/src/lib/services/session.ts` is the verifying half,
 * and the two must agree on the claim set exactly.
 */

/**
 * D-049: 120 seconds. Tolerates clock skew between two independently deployed Vercel
 * projects without leaving a captured token useful for long.
 *
 * NOT to be confused with Auth.js's browser session lifetime — D-041 warns about exactly
 * this, so the two values deliberately live in different modules and share no constant.
 */
export const SERVICE_TOKEN_TTL_SECONDS = 120;

/**
 * D-050: `sub` is the caller's LINE user id, not an internal `User.id` — this app cannot
 * know a cuid it never fetched. D-045: no role claim. This is the complete claim set.
 */
export interface ServiceTokenClaims {
  readonly lineUserId: string;
  readonly member: boolean;
}

export async function mintServiceToken(
  claims: ServiceTokenClaims,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const issuedAtSeconds = Math.floor(now.getTime() / 1000);

  return new SignJWT({ member: claims.member })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.lineUserId)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + SERVICE_TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(secret));
}

/**
 * Fails loudly at the boundary rather than minting a token signed with `undefined`
 * (AGENTS.md). A short secret is refused here for the same reason `apps/api` refuses it —
 * HS256 needs 256 bits, and the two apps must agree or every call 401s.
 */
export function readSessionSecret(
  environment: Record<string, string | undefined> = process.env,
): string {
  const secret = environment.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters (D-039, D-041)",
    );
  }

  return secret;
}

/** D-025, D-040: `apps/api`'s origin, read server-side only. The browser never sees it. */
export function readApiOrigin(
  environment: Record<string, string | undefined> = process.env,
): string {
  return environment.API_ORIGIN ?? "http://localhost:3001";
}
