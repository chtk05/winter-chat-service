import { z } from "zod";

import { MINIMUM_SESSION_SECRET_LENGTH } from "@/lib/services/session";

export interface AuthConfig {
  readonly accessCode: string;
  readonly sessionSecret: string;
}

const authEnvironmentSchema = z.object({
  ACCESS_CODE: z.string().min(1, "ACCESS_CODE must not be empty"),

  SESSION_SECRET: z
    .string()
    .min(
      MINIMUM_SESSION_SECRET_LENGTH,
      `SESSION_SECRET must be at least ${MINIMUM_SESSION_SECRET_LENGTH} characters`,
    ),
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
    throw new ConfigurationError(
      `Invalid environment: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  const environmentValues = parsed.data;

  if (environmentValues.SESSION_SECRET === environmentValues.ACCESS_CODE) {
    throw new ConfigurationError(
      "SESSION_SECRET must be distinct from ACCESS_CODE (D-008)",
    );
  }

  return {
    accessCode: environmentValues.ACCESS_CODE,
    sessionSecret: environmentValues.SESSION_SECRET,
  };
}

export interface LineConfig {
  readonly channelSecret: string;
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

export interface StorageConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

const storageEnvironmentSchema = z.object({
  SUPABASE_URL: z.string().min(1, "SUPABASE_URL must not be empty"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY must not be empty"),
});

export function readStorageConfig(
  environment: Record<string, string | undefined>,
): StorageConfig {
  const parsed = storageEnvironmentSchema.safeParse(environment);

  if (!parsed.success) {
    throw new ConfigurationError(
      `Invalid environment: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return {
    url: parsed.data.SUPABASE_URL,
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}
