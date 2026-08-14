import type { Clock } from "@/lib/clock";
import type { AuthConfig } from "@/lib/config";
import { verifyServiceToken } from "@/lib/services/session";

export type CallerState =
  | {
      readonly authenticated: true;
      readonly lineUserId: string;
      readonly member: boolean;
      readonly expiresAt: Date;
    }
  | { readonly authenticated: false };

export interface CallerReaderDependencies {
  readonly config: Pick<AuthConfig, "sessionSecret">;
  readonly clock: Clock;
}

export function bearerToken(authorization: string | null): string | undefined {
  if (!authorization) {
    return undefined;
  }

  const match = /^Bearer +(\S+)$/i.exec(authorization.trim());

  return match ? match[1] : undefined;
}

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
