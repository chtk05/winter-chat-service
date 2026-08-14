import { NextResponse, type NextRequest } from "next/server";

import { getConversationStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import {
  getConversation,
  setConversationStatus,
  type ConversationResult,
} from "@/lib/services/conversations";

/** T-013: `GET` the thread header's conversation, `PATCH` its status (D-019). */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await context.params;

  return respond(await getConversation(conversationId, getConversationStore()));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await context.params;
  const body = await readJsonBody(request);

  return respond(
    await setConversationStatus(
      conversationId,
      body?.status,
      getConversationStore(),
    ),
  );
}

function respond(result: ConversationResult): NextResponse {
  if (result.outcome === "invalid-status") {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "Status must be one of Open, Pending or Closed.",
    );
  }

  if (result.outcome === "not-found") {
    return errorResponse(404, ERROR_CODES.notFound, "No such conversation.");
  }

  return NextResponse.json(result.conversation);
}

async function readJsonBody(
  request: NextRequest,
): Promise<{ status?: unknown } | null> {
  try {
    const parsed: unknown = await request.json();
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    // A malformed body carries no status, which the service already maps to 400.
    return null;
  }
}
