import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { ConfigurationError, readLineConfig } from "@/lib/config";
import { getWebhookStore } from "@/lib/db/prisma";
import { createLineClient } from "@/lib/line/client";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { ingestWebhook } from "@/lib/services/webhook";

/**
 * T-006: `POST /api/line/webhook`. HTTP only — the ingest logic lives in the service.
 *
 * D-012: this is the one route with no token. LINE's servers call it directly rather than
 * through `apps/web`'s proxy (D-040), and the `X-Line-Signature` HMAC authenticates it
 * instead. Middleware exempts this path, and exempts it from the auth-config check too, so
 * a missing `SESSION_SECRET` cannot make LINE retry an event forever.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let config;
  try {
    config = readLineConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }
    // Never echoed to the caller — it names environment variables and the repo is public.
    console.error("[line/webhook] configuration error:", error.message);
    return errorResponse(
      500,
      ERROR_CODES.serverMisconfigured,
      "The server is not configured correctly.",
    );
  }

  // The RAW body, read exactly once. Parsing and re-serialising would change key order or
  // whitespace and the HMAC would never match.
  const rawBody = await request.text();

  const result = await ingestWebhook(
    { rawBody, signature: request.headers.get("x-line-signature") },
    {
      channelSecret: config.channelSecret,
      store: getWebhookStore(),
      line: createLineClient(config.channelAccessToken),
      clock: systemClock,
    },
  );

  if (result.outcome === "unauthorized") {
    // D-012: 401, logged, nothing written.
    return errorResponse(401, ERROR_CODES.unauthorized, "Invalid signature.");
  }

  if (result.outcome === "malformed") {
    // 400 — LINE does not retry these, which is right: the payload will never parse.
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "Malformed webhook payload.",
    );
  }

  // D-012: a prompt 2xx so LINE does not retry. Duplicates count as accepted — they were
  // already stored, and asking LINE to send them again would achieve nothing.
  return NextResponse.json(
    { accepted: result.stored, duplicates: result.skipped },
    { status: 200 },
  );
}
