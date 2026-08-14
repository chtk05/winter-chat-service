import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { getDashboardStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { isDashboardRange, summarizeDashboard } from "@/lib/services/dashboard";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = request.nextUrl.searchParams.get("range");
  const range = raw === null || raw === "" ? "today" : raw;

  if (!isDashboardRange(range)) {
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
