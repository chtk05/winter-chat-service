import { NextResponse, type NextRequest } from "next/server";

import { getConversationStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { markConversationRead } from "@/lib/services/conversations";

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
