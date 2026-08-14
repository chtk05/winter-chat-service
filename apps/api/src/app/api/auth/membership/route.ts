import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { getMemberStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { routeContext } from "@/lib/http/route-context";
import { bearerToken } from "@/lib/services/session-state";
import { verifyServiceToken } from "@/lib/services/session";

/**
 * D-054: `GET /api/auth/membership` — the authoritative answer to "is this caller a
 * member?", for the subject the token names (D-050).
 *
 * This exists because the Auth.js `jwt` callback must NOT trust its own update payload:
 * `trigger: "update"` fires for a browser calling `useSession().update()`, so believing
 * `session.member` would let any LINE user grant themselves membership without the join
 * code. `apps/web` calls this instead, once, right after a join.
 *
 * MEMBERS-OPTIONAL, like `/api/auth/join` — the only callers that need it hold a token
 * whose `member` claim is `false`. It grants nothing and is safe to call in that state.
 */
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

  // Read from the database, not from the token's own claim — the token is exactly what
  // this endpoint exists to correct.
  const member = await getMemberStore().isMember(
    verification.claims.lineUserId,
  );

  return NextResponse.json({ member });
}
