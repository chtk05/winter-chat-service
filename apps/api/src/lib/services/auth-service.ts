import type { Clock } from "@/lib/clock";
import type { AuthConfig } from "@/lib/config";
import { isAccessCodeCorrect } from "@/lib/services/access-code";
import { issueSession } from "@/lib/services/session";

/**
 * The login use case, composed from the services it needs. This layer knows nothing
 * about `NextRequest`/`NextResponse` (AGENTS.md, Single Responsibility) — the route
 * handler maps the outcome below onto a status code, and nothing else.
 */
export interface AuthDependencies {
  readonly config: AuthConfig;
  readonly clock: Clock;
}

export type LoginOutcome =
  | {
      readonly outcome: "authenticated";
      readonly token: string;
      readonly expiresAt: Date;
    }
  | { readonly outcome: "invalid-request" }
  | { readonly outcome: "rejected" };

export interface LoginInput {
  /** Unvalidated: it arrives from the request body. */
  readonly code: unknown;
}

/**
 * `openapi.yaml` maps a missing or empty code to 400. A wrong code is 401 (D-021).
 * D-032 removed the per-IP rate limit that used to run before either check.
 */
export async function login(
  input: LoginInput,
  dependencies: AuthDependencies,
): Promise<LoginOutcome> {
  const { config, clock } = dependencies;

  const submittedCode = normalizeSubmittedCode(input.code);

  if (submittedCode === null) {
    return { outcome: "invalid-request" };
  }

  if (!isAccessCodeCorrect(submittedCode, config.accessCode)) {
    return { outcome: "rejected" };
  }

  const session = await issueSession(config.sessionSecret, clock);

  return {
    outcome: "authenticated",
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

/**
 * `openapi.yaml` bounds the code at 1–128 characters. The frontend already trims before
 * sending (T-005); trimming again here means the contract holds regardless of client.
 */
function normalizeSubmittedCode(code: unknown): string | null {
  if (typeof code !== "string") {
    return null;
  }

  const trimmed = code.trim();

  if (trimmed.length === 0 || trimmed.length > 128) {
    return null;
  }

  return trimmed;
}

// Reading a session lives in `session-state.ts`, not here: middleware needs it on the
// Edge runtime, and this module reaches `node:crypto` through `access-code.ts`.
