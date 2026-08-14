import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { preflightResponse, routeContext } from "@/lib/http/route-context";
import { describeSession } from "@/lib/services/session-state";
import { SESSION_COOKIE_NAME } from "@/lib/services/session";

/**
 * `GET /auth/session` — D-008. Used by the client shell to decide whether to route to
 * the login page.
 *
 * The middleware already rejects an invalid session on this path, so in production the
 * 401 below is belt-and-braces. It stays because the handler must answer the contract on
 * its own terms — a route that is only correct because something upstream guarded it is
 * a route that breaks the moment the matcher changes.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = routeContext(request, "auth/session");

  if (!context.ok) {
    return context.response;
  }

  const state = await describeSession(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    { config: context.config, clock: systemClock },
  );

  if (!state.authenticated) {
    return errorResponse(
      401,
      ERROR_CODES.unauthorized,
      "Sign in to continue.",
      context.cors,
    );
  }

  return NextResponse.json(
    { authenticated: true, expiresAt: state.expiresAt.toISOString() },
    { status: 200, headers: context.cors },
  );
}

export function OPTIONS(request: NextRequest): NextResponse {
  return preflightResponse(request);
}
