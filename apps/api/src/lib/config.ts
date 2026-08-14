import { z } from "zod";

import { MINIMUM_SESSION_SECRET_LENGTH } from "@/lib/services/session";

/**
 * Environment is read through an explicit argument rather than reaching for
 * `process.env` inside a service, so misconfiguration is testable (AGENTS.md: fail
 * loudly at boundaries).
 *
 * Every variable here is already listed in `.env.example` against the decision that
 * introduced it. Nothing is read speculatively (CLAUDE.md §3.2).
 */
export interface AuthConfig {
  readonly accessCode: string;
  readonly sessionSecret: string;
  /** D-029: the exact origins allowed to send credentialed cross-origin requests. */
  readonly allowedOrigins: readonly string[];
}

const authEnvironmentSchema = z.object({
  // D-002, D-009 — the one shared workspace access code.
  ACCESS_CODE: z.string().min(1, "ACCESS_CODE must not be empty"),

  // D-008 — distinct from ACCESS_CODE; jose requires 256 bits for HS256.
  SESSION_SECRET: z
    .string()
    .min(
      MINIMUM_SESSION_SECRET_LENGTH,
      `SESSION_SECRET must be at least ${MINIMUM_SESSION_SECRET_LENGTH} characters`,
    ),

  // D-029 — comma-separated so preview deployments can be allowed alongside production
  // without a second variable. Never a wildcard: see cors.ts.
  WEB_ORIGIN: z.string().min(1, "WEB_ORIGIN must not be empty"),
});

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function readAuthConfig(
  environment: Record<string, string | undefined>,
): AuthConfig {
  const parsed = authEnvironmentSchema.safeParse(environment);

  if (!parsed.success) {
    // Only the variable names and rule violations are surfaced — never the values, which
    // are secrets in a public repo (D-001).
    throw new ConfigurationError(
      `Invalid environment: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  const environmentValues = parsed.data;

  if (environmentValues.SESSION_SECRET === environmentValues.ACCESS_CODE) {
    // D-008 records the signing secret as "distinct from the access code". If they were
    // equal, anyone holding the code could mint their own sessions.
    throw new ConfigurationError(
      "SESSION_SECRET must be distinct from ACCESS_CODE (D-008)",
    );
  }

  return {
    accessCode: environmentValues.ACCESS_CODE,
    sessionSecret: environmentValues.SESSION_SECRET,
    allowedOrigins: parseOrigins(environmentValues.WEB_ORIGIN),
  };
}

function parseOrigins(value: string): readonly string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
