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
  /** D-038: the one shared join code, checked after LINE Login. */
  readonly accessCode: string;
  /** D-041: the secret `apps/web` signs the service token with, shared with this app. */
  readonly sessionSecret: string;
}

const authEnvironmentSchema = z.object({
  // D-038 — the one shared join code. D-036 places it AFTER LINE Login: it establishes
  // whether an already-identified person is allowed in, not who they are.
  ACCESS_CODE: z.string().min(1, "ACCESS_CODE must not be empty"),

  // D-041 — verifies the service token minted by apps/web. D-039: the SAME value must be
  // set in both Vercel projects, and rotating it invalidates every session in both at once.
  SESSION_SECRET: z
    .string()
    .min(
      MINIMUM_SESSION_SECRET_LENGTH,
      `SESSION_SECRET must be at least ${MINIMUM_SESSION_SECRET_LENGTH} characters`,
    ),

  // D-040 retired WEB_ORIGIN along with cors.ts: no browser reaches this app, so there is
  // no origin to allow-list. It existed only for D-029's CORS allow-list.
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
    // D-008 records the signing secret as "distinct from the access code", and D-041 keeps
    // that constraint. If they were equal, anyone holding the join code could mint their
    // own service tokens — including one claiming `member: true`.
    throw new ConfigurationError(
      "SESSION_SECRET must be distinct from ACCESS_CODE (D-008)",
    );
  }

  return {
    accessCode: environmentValues.ACCESS_CODE,
    sessionSecret: environmentValues.SESSION_SECRET,
  };
}

/**
 * The LINE channel credentials, read SEPARATELY from the auth config on purpose.
 *
 * The webhook is the one route with no token (D-012), and it is exempt from the auth
 * config check in middleware so a missing `SESSION_SECRET` cannot make LINE retry an event
 * forever. Folding these four variables into one schema would undo that: a deployment
 * missing `ACCESS_CODE` would start failing the webhook too.
 */
export interface LineConfig {
  /** D-012: verifies the `X-Line-Signature` HMAC. Messaging API channel, NOT LINE Login. */
  readonly channelSecret: string;
  /** D-003, D-006: authorises the profile, Reply and Push calls. */
  readonly channelAccessToken: string;
}

const lineEnvironmentSchema = z.object({
  LINE_CHANNEL_SECRET: z
    .string()
    .min(1, "LINE_CHANNEL_SECRET must not be empty"),
  LINE_CHANNEL_ACCESS_TOKEN: z
    .string()
    .min(1, "LINE_CHANNEL_ACCESS_TOKEN must not be empty"),
});

export function readLineConfig(
  environment: Record<string, string | undefined>,
): LineConfig {
  const parsed = lineEnvironmentSchema.safeParse(environment);

  if (!parsed.success) {
    throw new ConfigurationError(
      `Invalid environment: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return {
    channelSecret: parsed.data.LINE_CHANNEL_SECRET,
    channelAccessToken: parsed.data.LINE_CHANNEL_ACCESS_TOKEN,
  };
}
