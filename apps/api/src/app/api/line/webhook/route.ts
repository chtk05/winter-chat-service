import { NextResponse, type NextRequest } from "next/server";

import { systemClock } from "@/lib/clock";
import {
  ConfigurationError,
  readLineConfig,
  readStorageConfig,
} from "@/lib/config";
import { getWebhookStore } from "@/lib/db/prisma";
import { createLineClient } from "@/lib/line/client";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import { createStorageClient, type StorageClient } from "@/lib/storage/client";
import { ingestWebhook } from "@/lib/services/webhook";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let config;
  try {
    config = readLineConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }
    console.error("[line/webhook] configuration error:", error.message);
    return errorResponse(
      500,
      ERROR_CODES.serverMisconfigured,
      "The server is not configured correctly.",
    );
  }

  const rawBody = await request.text();

  const result = await ingestWebhook(
    { rawBody, signature: request.headers.get("x-line-signature") },
    {
      channelSecret: config.channelSecret,
      store: getWebhookStore(),
      line: createLineClient(config.channelAccessToken),
      clock: systemClock,
      storage: getStorageClientOrNoop(),
    },
  );

  if (result.outcome === "unauthorized") {
    return errorResponse(401, ERROR_CODES.unauthorized, "Invalid signature.");
  }

  if (result.outcome === "malformed") {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "Malformed webhook payload.",
    );
  }

  return NextResponse.json(
    { accepted: result.stored, duplicates: result.skipped },
    { status: 200 },
  );
}

let loggedMissingStorageConfig = false;

function getStorageClientOrNoop(): StorageClient {
  try {
    return createStorageClient(readStorageConfig(process.env));
  } catch {
    if (!loggedMissingStorageConfig) {
      console.warn(
        "[line/webhook] Supabase Storage is not configured — inbound images will fall back to the unsupported-type placeholder.",
      );
      loggedMissingStorageConfig = true;
    }
    return {
      async upload() {
        return null;
      },
    };
  }
}
