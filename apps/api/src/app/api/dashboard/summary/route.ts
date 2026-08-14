import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { getDashboardStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { isDashboardRange, summarizeDashboard } from "@/lib/services/dashboard";

/** T-015: `GET /api/dashboard/summary` — F-003's metrics and no others (D-020). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = request.nextUrl.searchParams.get("range");
  // `openapi.yaml` gives `range` a default of `today`.
  const range = raw === null || raw === "" ? "today" : raw;

  if (!isDashboardRange(range)) {
    // The design's 30d range is out of scope (D-020) and must not be silently accepted.
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "range must be today or 7d.",
    );
  }

  const summary = await summarizeDashboard(
    range,
    getDashboardStore(),
    systemClock,
  );

  return NextResponse.json(summary);
}
