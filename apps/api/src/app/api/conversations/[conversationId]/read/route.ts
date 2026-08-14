import { NextResponse, type NextRequest } from "next/server";

import { getConversationStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { markConversationRead } from "@/lib/services/conversations";

/**
 * T-013: `POST /api/conversations/{id}/read` — D-007, opening a thread marks all of it
 * read. Read state is workspace-wide and shared across every member (D-009, D-045), so
 * this is not per-caller. Idempotent.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await context.params;

  const result = await markConversationRead(
    conversationId,
    getConversationStore(),
  );

  if (result === "not-found") {
    return errorResponse(404, ERROR_CODES.notFound, "No such conversation.");
  }

  return new NextResponse(null, { status: 204 });
}
