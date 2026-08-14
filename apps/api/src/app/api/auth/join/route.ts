import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { getMemberStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { routeContext } from "@/lib/http/route-context";
import { joinWorkspace } from "@/lib/services/auth-service";
import { bearerToken } from "@/lib/services/session-state";
import { verifyServiceToken } from "@/lib/services/session";

/**
 * D-036's join gate: `POST /api/auth/join`. HTTP only — the decision lives in
 * `auth-service.ts` (AGENTS.md layering).
 *
 * D-046 makes this the one members-optional route: the caller's token legitimately claims
 * `member: false` here, and middleware lets it through for this path alone. The token is
 * still verified — twice over, in fact. Middleware proves it valid before this handler
 * runs, and this handler re-reads it to learn WHICH user is joining. It cannot take the
 * identity from the body: that would let any authenticated caller grant membership to
 * anyone else's LINE id.
 *
 * D-039: this route sets no cookies. Nothing in this app does.
 */
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
    // Unreachable through middleware, which already refused. Kept because this handler
    // must not depend on middleware for its identity — an unauthenticated request that
    // reached it directly would otherwise have no subject to join.
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
    // Identical body for every wrong code, as `openapi.yaml` requires of the code check.
    return errorResponse(
      401,
      ERROR_CODES.invalidAccessCode,
      "That access code didn't work.",
    );
  }

  // 204 whether this was the first join or a repeat — D-046 makes membership idempotent,
  // and telling the caller which it was would leak nothing useful and vary the contract.
  return new NextResponse(null, { status: 204 });
}

async function readJsonBody(
  request: NextRequest,
): Promise<{ code?: unknown } | null> {
  try {
    const parsed: unknown = await request.json();
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    // A malformed body is a missing code, which the use case already maps to 400.
    return null;
  }
}
