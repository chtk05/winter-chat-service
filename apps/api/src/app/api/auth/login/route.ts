import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { preflightResponse, routeContext } from "@/lib/http/route-context";
import { login } from "@/lib/services/auth-service";
import {
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_SECONDS,
} from "@/lib/services/session";

/**
 * `POST /auth/login` — D-002, D-008, D-017, D-030.
 *
 * HTTP only: parse the request, call the service, map the outcome to a status. All of
 * the decision-making lives in `lib/services/auth-service.ts` (AGENTS.md layering).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = routeContext(request, "auth/login");

  if (!context.ok) {
    return context.response;
  }

  const { config, cors } = context;
  const body = await readJsonBody(request);

  const result = await login(
    { code: body?.code },
    { config, clock: systemClock },
  );

  switch (result.outcome) {
    case "invalid-request":
      return errorResponse(
        400,
        ERROR_CODES.badRequest,
        "An access code is required.",
        cors,
      );

    case "rejected":
      // D-021: the body is identical for every wrong code, so nothing distinguishes
      // "close" from "nowhere near".
      return errorResponse(
        401,
        ERROR_CODES.invalidAccessCode,
        "That access code didn't work.",
        cors,
      );

    case "authenticated": {
      const response = new NextResponse(null, { status: 204, headers: cors });

      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: result.token,
        httpOnly: true,
        secure: true,
        // D-029: the console is a different origin (D-025), so `Lax` would never be sent.
        sameSite: "none",
        path: "/",
        maxAge: SESSION_LIFETIME_SECONDS,
      });

      return response;
    }
  }
}

export function OPTIONS(request: NextRequest): NextResponse {
  return preflightResponse(request);
}

/** A body that is absent or not JSON is treated as an absent code, and answered 400. */
async function readJsonBody(
  request: NextRequest,
): Promise<{ code?: unknown } | null> {
  try {
    const parsed: unknown = await request.json();
    return typeof parsed === "object" && parsed !== null
      ? (parsed as { code?: unknown })
      : null;
  } catch {
    return null;
  }
}
