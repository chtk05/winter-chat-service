import type { AuthConfig } from "@/lib/config";
import { isAccessCodeCorrect } from "@/lib/services/access-code";

/**
 * D-036's second gate: the caller has already proved *who* they are with LINE Login
 * (handled by NextAuth in `apps/web`, D-039). This use case decides *whether they are
 * allowed in*, and records the answer.
 *
 * This layer knows nothing about `NextRequest`/`NextResponse` (AGENTS.md, Single
 * Responsibility) — the route handler maps the outcome below onto a status code, and
 * nothing else.
 *
 * The login/logout/session use cases that used to live here are gone: D-039 moved them to
 * `apps/web` under NextAuth, and this app sets no cookies at all.
 */

/**
 * The narrow slice of persistence this use case needs, as an explicit collaborator
 * (AGENTS.md, Dependency Inversion). `lib/db/user-store.ts` supplies the Prisma-backed
 * implementation; tests supply a double.
 */
export interface MemberStore {
  /**
   * D-050: upsert on the LINE user id, so a first join creates the `User` row and a
   * repeat join is idempotent by construction rather than by a read-then-write race.
   * Returns whether this call was the one that granted membership.
   */
  grantMembership(lineUserId: string): Promise<{ alreadyMember: boolean }>;

  /**
   * D-054: the authoritative membership read, backing `GET /api/auth/membership`.
   * An unknown LINE user id is not a member — absence is the answer, not an error.
   */
  isMember(lineUserId: string): Promise<boolean>;
}

export interface JoinDependencies {
  readonly config: Pick<AuthConfig, "accessCode">;
  readonly store: MemberStore;
}

export type JoinOutcome =
  | { readonly outcome: "joined"; readonly alreadyMember: boolean }
  | { readonly outcome: "invalid-request" }
  | { readonly outcome: "rejected" };

export interface JoinInput {
  /** Unvalidated: it arrives from the request body. */
  readonly code: unknown;
  /** From the verified token, never from the body (D-050). */
  readonly lineUserId: string;
}

/**
 * A missing or empty code is 400; a wrong code is 401 (D-021, carried over from the
 * withdrawn login route — the check moved, its contract did not).
 */
export async function joinWorkspace(
  input: JoinInput,
  dependencies: JoinDependencies,
): Promise<JoinOutcome> {
  const submittedCode = normalizeSubmittedCode(input.code);

  if (submittedCode === null) {
    return { outcome: "invalid-request" };
  }

  if (!isAccessCodeCorrect(submittedCode, dependencies.config.accessCode)) {
    // D-032 removed per-IP rate limiting outright. D-038's code sits behind LINE Login,
    // which raises the cost of attacking it, but does NOT restore that protection.
    return { outcome: "rejected" };
  }

  const { alreadyMember } = await dependencies.store.grantMembership(
    input.lineUserId,
  );

  return { outcome: "joined", alreadyMember };
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

// Reading the caller lives in `session-state.ts`, not here: middleware needs it on the
// Edge runtime, and this module reaches `node:crypto` through `access-code.ts`.
