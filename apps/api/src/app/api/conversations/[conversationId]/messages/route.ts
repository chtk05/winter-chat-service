import { NextResponse, type NextRequest } from "next/server";

import { getThreadStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { listThreadMessages, MAX_MESSAGE_LIMIT } from "@/lib/services/thread";

/**
 * T-014: `GET /api/conversations/{id}/messages` — paged history, newest last.
 *
 * `POST` (sending) is T-008 and is deliberately absent: this file must not grow a send
 * path by proximity. A POST to this route currently answers 405 from the framework, which
 * is the honest answer for a route that is not built.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await context.params;
  const parameters = request.nextUrl.searchParams;

  const result = await listThreadMessages(
    {
      conversationId,
      before: parameters.get("before"),
      limit: parameters.get("limit"),
    },
    getThreadStore(),
  );

  if (result.outcome === "invalid-limit") {
    // D-026: rejected, never silently clamped.
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      `limit must be an integer between 1 and ${MAX_MESSAGE_LIMIT}.`,
    );
  }

  if (result.outcome === "not-found") {
    return errorResponse(404, ERROR_CODES.notFound, "No such conversation.");
  }

  return NextResponse.json(result.page);
}
