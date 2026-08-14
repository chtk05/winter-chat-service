import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { readAuthConfig } from "@/lib/config";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { describeCaller } from "@/lib/services/session-state";

/**
 * D-039: route protection for a stateless resource server. D-025 split the middleware in
 * two — `apps/web` guards pages and redirects to the sign-in screen, `apps/api` (here)
 * guards routes and answers 401. Neither can see the other's request, so this file never
 * redirects.
 *
 * D-040: no CORS. Every caller is `apps/web`'s server-side proxy, not a browser, so there
 * is no origin to allow-list and no preflight to answer.
 *
 * Nothing here touches Prisma: middleware runs on the Edge runtime, and the token is
 * stateless by D-041, so verifying it needs only the signing secret.
 */

/**
 * Callers with no token at all.
 *
 * `/api/line/webhook` is called by LINE's servers directly, not through `apps/web`'s
 * proxy, and D-012 authenticates it with an `X-Line-Signature` HMAC instead of a token.
 * `openapi.yaml` records it as `security: []`.
 */
const UNAUTHENTICATED_PATHS: readonly string[] = ["/api/line/webhook"];

/**
 * D-046's bootstrap constraint, and the reason this list exists at all: a freshly
 * authenticated user holds a token whose `member` claim is `false`, and the join endpoint
 * is precisely the route that must accept one. It is the ONLY members-optional route, and
 * it is named here explicitly rather than inferred from the path.
 */
const MEMBERS_OPTIONAL_PATHS: readonly string[] = [
  "/api/auth/join",
  // D-054: the membership read. Only a `member: false` token ever needs it, and it grants
  // nothing. Keep this list short and explicit — every entry is a route a non-member reaches.
  "/api/auth/membership",
];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  if (UNAUTHENTICATED_PATHS.includes(path)) {
    return NextResponse.next();
  }

  const config = safelyReadConfig();

  if (!config) {
    console.error("[middleware] configuration error: refusing all requests");
    return errorResponse(
      500,
      ERROR_CODES.serverMisconfigured,
      "The server is not configured correctly.",
    );
  }

  const caller = await describeCaller(request.headers.get("authorization"), {
    config,
    clock: systemClock,
  });

  if (!caller.authenticated) {
    return errorResponse(401, ERROR_CODES.unauthorized, "Sign in to continue.");
  }

  // D-036's third state, and the place a security bug would appear: a valid token proves
  // a LINE identity, NOT membership. Treating "has a valid token" as "is a member" would
  // admit any LINE user on the platform.
  if (!caller.member && !MEMBERS_OPTIONAL_PATHS.includes(path)) {
    return errorResponse(
      403,
      ERROR_CODES.notAMember,
      "Enter your join code to continue.",
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
