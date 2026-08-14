import { createHash, timingSafeEqual } from "node:crypto";

export function isAccessCodeCorrect(
  submitted: string,
  expected: string,
): boolean {
  if (submitted.length === 0 || expected.length === 0) {
    return false;
  }

  return timingSafeEqual(digest(submitted), digest(expected));
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}
