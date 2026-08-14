import { NextResponse } from "next/server";

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export const ERROR_CODES = {
  badRequest: "BAD_REQUEST",
  invalidAccessCode: "INVALID_ACCESS_CODE",
  unauthorized: "UNAUTHORIZED",
  notAMember: "NOT_A_MEMBER",
  notFound: "NOT_FOUND",
  serverMisconfigured: "SERVER_MISCONFIGURED",
  notRetryable: "NOT_RETRYABLE",
  uploadFailed: "UPLOAD_FAILED",
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
