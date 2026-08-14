import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { readAuthConfig } from "@/lib/config";
import { corsHeaders } from "@/lib/http/cors";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { describeSession } from "@/lib/services/session-state";
import { SESSION_COOKIE_NAME } from "@/lib/services/session";

/**
 * D-008: route protection. D-025 split the middleware in two — `apps/web` guards pages
 * and redirects to the login screen, `apps/api` (here) guards routes and answers 401.
 * Neither can see the other's request, so this file never redirects.
 *
 * Nothing here touches Prisma: middleware runs on the edge runtime, and the session is
 * stateless by D-008, so verifying it needs only the signing secret.
 */
const UNAUTHENTICATED_PATHS: readonly string[] = [
  // D-021: the only two unauthenticated paths in the contract.
  "/api/auth/login",
  "/api/line/webhook",
  // Not in D-021's list, but `openapi.yaml` records logout as idempotent and succeeding
  // with no session present — guarding it would make an expired cookie unclearable.
  "/api/auth/logout",
];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // A CORS preflight carries no cookies by design, so it can never be authenticated.
  // Each route's own OPTIONS handler answers it.
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  if (UNAUTHENTICATED_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const config = safelyReadConfig();

  if (!config) {
    console.error("[middleware] configuration error: refusing all requests");
    return errorResponse(
      500,
      ERROR_CODES.serverMisconfigured,
      "The server is not configured correctly.",
      corsHeaders(request.headers.get("origin"), []),
    );
  }

  const state = await describeSession(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    { config, clock: systemClock },
  );

  if (!state.authenticated) {
    // D-029: the 401 needs CORS headers of its own, or the browser hides the status from
    // the console and the client cannot tell "rejected" from "network failure".
    return errorResponse(
      401,
      ERROR_CODES.unauthorized,
      "Sign in to continue.",
      corsHeaders(request.headers.get("origin"), config.allowedOrigins),
    );
  }

  return NextResponse.next();
}

function safelyReadConfig() {
  try {
    return readAuthConfig(process.env);
  } catch {
    return null;
  }
}

export const config = {
  // Only the API surface. `apps/api` serves nothing else (D-025, D-030).
  matcher: "/api/:path*",
};
