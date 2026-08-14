import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { getSyncStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { parseSince, waitForActivity } from "@/lib/services/sync";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const since = parseSince(request.nextUrl.searchParams.get("since"));

  if (since === "invalid") {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "since must be an RFC 3339 timestamp.",
    );
  }

  const result = await waitForActivity(since, getSyncStore(), systemClock, {
    signal: request.signal,
  });

  return NextResponse.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
