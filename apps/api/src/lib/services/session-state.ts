import type { Clock } from "@/lib/clock";
import type { AuthConfig } from "@/lib/config";
import { verifySession } from "@/lib/services/session";

/**
 * Reading a session, kept deliberately separate from issuing one (`auth-service.ts`).
 *
 * The split is not stylistic. D-008 puts route protection in middleware, which runs on
 * the Edge runtime; `auth-service.ts` reaches `access-code.ts` and therefore
 * `node:crypto`, which the Edge runtime does not provide. Importing the login use case
 * from middleware pulled that dependency along and the build said so. Verifying a
 * signature needs only `jose`, which is Edge-safe, so this module has no other imports.
 */
export type SessionState =
  | { readonly authenticated: true; readonly expiresAt: Date }
  | { readonly authenticated: false };

export interface SessionReaderDependencies {
  readonly config: Pick<AuthConfig, "sessionSecret">;
  readonly clock: Clock;
}

/** Backs `GET /auth/session` and the middleware guard (D-008). */
export async function describeSession(
  token: string | undefined,
  dependencies: SessionReaderDependencies,
): Promise<SessionState> {
  const verification = await verifySession(
    token,
    dependencies.config.sessionSecret,
    dependencies.clock,
  );

  if (!verification.valid) {
    return { authenticated: false };
  }

  return { authenticated: true, expiresAt: verification.expiresAt };
}
