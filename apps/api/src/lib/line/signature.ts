import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * D-012: every webhook request carries an `X-Line-Signature` header — the base64 HMAC-SHA256
 * of the **raw request body** under the channel secret. An invalid signature is a 401 with
 * nothing written.
 *
 * The body must be the exact bytes LINE sent. Re-serialising a parsed object would change
 * key order or whitespace and the HMAC would never match, so the route reads `request.text()`
 * once and passes the string through unmodified.
 *
 * D-053: no SDK — this is `node:crypto` and nothing else.
 */
export function isWebhookSignatureValid(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): boolean {
  // Guard clause: an empty secret would otherwise produce a valid, forgeable HMAC. The
  // config refuses to boot in that state, but this function must not rely on its caller.
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

  // `timingSafeEqual` throws on a length mismatch, which would leak the expected length
  // through the difference between "threw" and "compared". Checked first, and the check
  // itself reveals only that the header was the wrong size.
  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}
