import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { readAuthConfig } from "@/lib/config";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { describeCaller } from "@/lib/services/session-state";

const UNAUTHENTICATED_PATHS: readonly string[] = ["/api/line/webhook"];

const MEMBERS_OPTIONAL_PATHS: readonly string[] = [
  "/api/auth/join",
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
  matcher: "/api/:path*",
};
