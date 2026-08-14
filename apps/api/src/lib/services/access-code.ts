import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Case-INSENSITIVE by design, not by oversight: the join screen's input visibly
 * displays whatever is typed as uppercase (`text-transform: uppercase`, purely
 * cosmetic — it does not change the actual value), so a code containing lowercase
 * characters (this workspace's real code does) LOOKS identical to its uppercase
 * form while being a different string underneath. A user who types the code by
 * eye rather than pasting it verbatim was silently rejected — case was never a
 * chosen security property here (checked: no decision requires it), just an
 * incidental consequence of hashing the raw string.
 */
export function isAccessCodeCorrect(
  submitted: string,
  expected: string,
): boolean {
  if (submitted.length === 0 || expected.length === 0) {
    return false;
  }

  return timingSafeEqual(
    digest(submitted.toLowerCase()),
    digest(expected.toLowerCase()),
  );
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}
