import { SignJWT } from "jose";

export const SERVICE_TOKEN_TTL_SECONDS = 120;

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

export function readApiOrigin(
  environment: Record<string, string | undefined> = process.env,
): string {
  return environment.API_ORIGIN ?? "http://localhost:3001";
}
