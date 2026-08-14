export const CHAT_MEDIA_BUCKET = "chat-media";

export const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function extensionForMimeType(mimeType: string): string | null {
  return EXTENSION_BY_MIME[mimeType] ?? null;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
