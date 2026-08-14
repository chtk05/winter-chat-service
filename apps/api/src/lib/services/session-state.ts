import type { Clock } from "@/lib/clock";
import type { AuthConfig } from "@/lib/config";
import { verifyServiceToken } from "@/lib/services/session";

/**
 * Reading the caller's identity from a request, kept separate from the join use case
 * (`auth-service.ts`).
 *
 * The split is not stylistic. D-039 puts route protection in middleware, which runs on the
 * Edge runtime; `auth-service.ts` reaches `access-code.ts` and therefore `node:crypto`,
 * which the Edge runtime does not provide. Importing the join use case from middleware
 * pulled that dependency along and the build said so. Verifying a signature needs only
 * `jose`, which is Edge-safe, so this module has no other imports.
 */
export type CallerState =
  | {
      readonly authenticated: true;
      /** D-050: the LINE user id the token names. */
      readonly lineUserId: string;
      /** D-036: authenticated is not the same as member. Three states, not two. */
      readonly member: boolean;
      readonly expiresAt: Date;
    }
  | { readonly authenticated: false };

export interface CallerReaderDependencies {
  readonly config: Pick<AuthConfig, "sessionSecret">;
  readonly clock: Clock;
}

/**
 * D-041: the token arrives as `Authorization: Bearer <jwt>`. Parsing is deliberately
 * strict — the scheme must be exactly `Bearer`, case-insensitively, followed by one
 * token. Anything else yields no token rather than a best-effort guess.
 */
export function bearerToken(authorization: string | null): string | undefined {
  if (!authorization) {
    return undefined;
  }

  const match = /^Bearer +(\S+)$/i.exec(authorization.trim());

  return match ? match[1] : undefined;
}

/** Backs the middleware guard (D-039, D-046). */
export async function describeCaller(
  authorization: string | null,
  dependencies: CallerReaderDependencies,
): Promise<CallerState> {
  const verification = await verifyServiceToken(
    bearerToken(authorization),
    dependencies.config.sessionSecret,
    dependencies.clock,
  );

  if (!verification.valid) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    lineUserId: verification.claims.lineUserId,
    member: verification.claims.member,
    expiresAt: verification.expiresAt,
  };
}
