import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { ConfigurationError, readLineConfig } from "@/lib/config";
import { getSendStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { createLineClient } from "@/lib/line/client";
import { retryMessage, type SendResult } from "@/lib/services/send";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ messageId: string }> },
): Promise<NextResponse> {
  const { messageId } = await context.params;

  let config;
  try {
    config = readLineConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }
    console.error("[messages/retry] configuration error:", error.message);
    return errorResponse(
      500,
      ERROR_CODES.serverMisconfigured,
      "The server is not configured correctly.",
    );
  }

  const result = await retryMessage(messageId, {
    store: getSendStore(),
    line: createLineClient(config.channelAccessToken),
    clock: systemClock,
  });

  return respond(result);
}

function respond(result: SendResult): NextResponse {
  if (result.outcome === "not-found") {
    return errorResponse(404, ERROR_CODES.notFound, "No such message.");
  }

  if (result.outcome === "not-retryable") {
    return errorResponse(
      409,
      ERROR_CODES.notRetryable,
      "Message is not in a retryable state.",
    );
  }

  if (
    result.outcome === "invalid-text" ||
    result.outcome === "invalid-media-url" ||
    result.outcome === "missing-client-id"
  ) {
    return errorResponse(400, ERROR_CODES.badRequest, "Invalid request.");
  }

  return NextResponse.json(result.message, { status: 202 });
}
