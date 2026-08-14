import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { ConfigurationError, readStorageConfig } from "@/lib/config";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  CHAT_MEDIA_BUCKET,
  MAX_UPLOAD_BYTES,
  extensionForMimeType,
} from "@/lib/storage/bucket";
import { createStorageClient } from "@/lib/storage/client";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let storageConfig;
  try {
    storageConfig = readStorageConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }
    console.error("[uploads] configuration error:", error.message);
    return errorResponse(
      500,
      ERROR_CODES.serverMisconfigured,
      "The server is not configured correctly.",
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "Expected a multipart/form-data body with a file field.",
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return errorResponse(400, ERROR_CODES.badRequest, "A file is required.");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "Only JPEG, PNG, GIF or WebP images are accepted.",
    );
  }

  if (file.size === 0) {
    return errorResponse(400, ERROR_CODES.badRequest, "The file is empty.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      `Image must be ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB or smaller.`,
    );
  }

  const extension = extensionForMimeType(file.type);
  if (!extension) {
    return errorResponse(
      400,
      ERROR_CODES.badRequest,
      "Unsupported image type.",
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const uploaded = await createStorageClient(storageConfig).upload({
    bucket: CHAT_MEDIA_BUCKET,
    path: `outbound/${randomUUID()}.${extension}`,
    bytes,
    contentType: file.type,
  });

  if (!uploaded) {
    return errorResponse(
      502,
      ERROR_CODES.uploadFailed,
      "Could not store the image.",
    );
  }

  return NextResponse.json({ url: uploaded.url }, { status: 201 });
}
