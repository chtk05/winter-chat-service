import { createHash, timingSafeEqual } from "node:crypto";

/**
 * D-002, D-009: authentication is a comparison against the ONE shared workspace access
 * code held in `ACCESS_CODE`. There are no per-user accounts and nothing to look up.
 *
 * The comparison is constant-time. Both sides are hashed first so that
 * `timingSafeEqual` always receives two equal-length buffers — comparing the raw strings
 * would either throw on a length mismatch or leak the expected code's length through the
 * difference between "threw immediately" and "compared byte by byte".
 */
export function isAccessCodeCorrect(
  submitted: string,
  expected: string,
): boolean {
  // Guard clause: an empty expected code would otherwise make every empty submission
  // succeed. D-021 already rejects an empty submission with 400 before reaching here,
  // but this function must not depend on its caller for that.
  if (submitted.length === 0 || expected.length === 0) {
    return false;
  }

  return timingSafeEqual(digest(submitted), digest(expected));
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}
