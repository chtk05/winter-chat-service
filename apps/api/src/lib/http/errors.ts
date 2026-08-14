import { NextResponse } from "next/server";

/**
 * D-021's uniform error body: `{ error: { code, message, ref } }`, `code` in
 * SCREAMING_SNAKE_CASE. Declared once here rather than rebuilt at each call site.
 *
 * `ref` is optional in the contract and is **not** emitted. It is described there as a
 * "short support reference" backing the design's error card, but nothing on record says
 * what generates one or where it is looked up, and inventing a scheme would breach
 * CLAUDE.md §3.2. The frontend already renders a card without it (T-005 covers that
 * case). Raised as OQ-30.
 */
export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

/** Only the codes this app actually emits. Others belong to the tasks that emit them. */
export const ERROR_CODES = {
  badRequest: "BAD_REQUEST",
  invalidAccessCode: "INVALID_ACCESS_CODE",
  unauthorized: "UNAUTHORIZED",
  /** D-051: authenticated with LINE, but has not passed D-036's join gate. */
  notAMember: "NOT_A_MEMBER",
  notFound: "NOT_FOUND",
  serverMisconfigured: "SERVER_MISCONFIGURED",
} as const;

export function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
): NextResponse<ApiErrorBody> {
  return NextResponse.json(errorBody(code, message), { status, headers });
}
