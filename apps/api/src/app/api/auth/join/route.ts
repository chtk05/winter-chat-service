import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { getMemberStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { routeContext } from "@/lib/http/route-context";
import { joinWorkspace } from "@/lib/services/auth-service";
import { bearerToken } from "@/lib/services/session-state";
import { verifyServiceToken } from "@/lib/services/session";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = routeContext("auth/join");

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

  const body = await readJsonBody(request);

  const result = await joinWorkspace(
    { code: body?.code, lineUserId: verification.claims.lineUserId },
    { config: context.config, store: getMemberStore() },
  );

  if (result.outcome === "invalid-request") {
    return errorResponse(400, ERROR_CODES.badRequest, "Enter your join code.");
  }

  if (result.outcome === "rejected") {
    return errorResponse(
      401,
      ERROR_CODES.invalidAccessCode,
      "That access code didn't work.",
    );
  }

  return new NextResponse(null, { status: 204 });
}

async function readJsonBody(
  request: NextRequest,
): Promise<{ code?: unknown } | null> {
  try {
    const parsed: unknown = await request.json();
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
