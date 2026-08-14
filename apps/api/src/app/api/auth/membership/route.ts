import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { getMemberStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { routeContext } from "@/lib/http/route-context";
import { bearerToken } from "@/lib/services/session-state";
import { verifyServiceToken } from "@/lib/services/session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = routeContext("auth/membership");

  if (!context.ok) {
    return context.response;
  }

  const verification = await verifyServiceToken(
    bearerToken(request.headers.get("authorization")),
    context.config.sessionSecret,
    systemClock,
  );

  if (!verification.valid) {
    return errorResponse(401, ERROR_CODES.unauthorized, "Sign in to continue.");
  }

  const member = await getMemberStore().isMember(
    verification.claims.lineUserId,
  );

  return NextResponse.json({ member });
}
