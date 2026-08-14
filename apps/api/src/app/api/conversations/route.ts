import { NextResponse, type NextRequest } from "next/server";

import { getConversationStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { listConversations } from "@/lib/services/conversations";

/** T-013: `GET /api/conversations`. HTTP only — the query semantics live in the service. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const parameters = request.nextUrl.searchParams;

  const result = await listConversations(
    {
      status: parameters.get("status"),
      search: parameters.get("search"),
      cursor: parameters.get("cursor"),
    },
    getConversationStore(),
  );

  if (result.outcome === "invalid-status") {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "Unknown conversation status.",
    );
  }

  return NextResponse.json(result.list);
}
