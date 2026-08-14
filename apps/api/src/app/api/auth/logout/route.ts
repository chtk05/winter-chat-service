import { NextResponse, type NextRequest } from "next/server";

import { preflightResponse, routeContext } from "@/lib/http/route-context";
import { SESSION_COOKIE_NAME } from "@/lib/services/session";

/**
 * `POST /auth/logout` — D-008.
 *
 * `openapi.yaml` records this as idempotent: it succeeds with no session present. It is
 * therefore not guarded by the middleware, since demanding a valid session before
 * clearing one would make an expired cookie impossible to clear.
 */
export function POST(request: NextRequest): NextResponse {
  const context = routeContext(request, "auth/logout");

  if (!context.ok) {
    return context.response;
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: context.cors,
  });

  // Cleared by overwriting with an empty value at Max-Age 0. Every other attribute must
  // match the cookie set at login (D-029) or the browser treats it as a different cookie
  // and leaves the original in place.
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export function OPTIONS(request: NextRequest): NextResponse {
  return preflightResponse(request);
}
