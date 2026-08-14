import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import { ConfigurationError, readLineConfig } from "@/lib/config";
import { getSendStore, getThreadStore } from "@/lib/db/prisma";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { createLineClient } from "@/lib/line/client";
import { sendMessage, type SendResult } from "@/lib/services/send";
import { listThreadMessages, MAX_MESSAGE_LIMIT } from "@/lib/services/thread";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await context.params;
  const parameters = request.nextUrl.searchParams;

  const result = await listThreadMessages(
    {
      conversationId,
      before: parameters.get("before"),
      limit: parameters.get("limit"),
    },
    getThreadStore(),
  );

  if (result.outcome === "invalid-limit") {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      `limit must be an integer between 1 and ${MAX_MESSAGE_LIMIT}.`,
    );
  }

  if (result.outcome === "not-found") {
    return errorResponse(404, ERROR_CODES.notFound, "No such conversation.");
  }

  return NextResponse.json(result.page);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await context.params;

  let config;
  try {
    config = readLineConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }
    console.error("[messages:POST] configuration error:", error.message);
    return errorResponse(
      500,
      ERROR_CODES.serverMisconfigured,
      "The server is not configured correctly.",
    );
  }

  const body = await readJsonBody(request);

  const result = await sendMessage(
    {
      conversationId,
      text: body?.text,
      mediaUrl: body?.mediaUrl,
      clientId: body?.clientId,
      closeAfterSend: body?.closeAfterSend,
    },
    {
      store: getSendStore(),
      line: createLineClient(config.channelAccessToken),
      clock: systemClock,
    },
  );

  return respondSend(result);
}

function respondSend(result: SendResult): NextResponse {
  if (result.outcome === "invalid-text") {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      `text must be between 1 and 5000 characters.`,
    );
  }

  if (result.outcome === "invalid-media-url") {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "mediaUrl must be an https url.",
    );
  }

  if (result.outcome === "missing-client-id") {
    return errorResponse(400, ERROR_CODES.badRequest, "clientId is required.");
  }

  if (result.outcome === "not-found") {
    return errorResponse(404, ERROR_CODES.notFound, "No such conversation.");
  }

  if (result.outcome === "not-retryable") {
    return errorResponse(
      409,
      ERROR_CODES.notRetryable,
      "Message is not in a retryable state.",
    );
  }

  return NextResponse.json(result.message, { status: 202 });
}

async function readJsonBody(request: NextRequest): Promise<{
  text?: unknown;
  mediaUrl?: unknown;
  clientId?: unknown;
  closeAfterSend?: unknown;
} | null> {
  try {
    const parsed: unknown = await request.json();
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
