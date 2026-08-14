import { createHmac, timingSafeEqual } from "node:crypto";

export function isWebhookSignatureValid(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): boolean {
  if (!signature || channelSecret.length === 0) {
    return false;
  }

  const expected = createHmac("sha256", channelSecret)
    .update(rawBody, "utf8")
    .digest();

  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}
