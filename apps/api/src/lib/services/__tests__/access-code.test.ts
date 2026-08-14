import { isAccessCodeCorrect } from "@/lib/services/access-code";

const EXPECTED = "CORRECT-ACCESS-CODE";

describe("isAccessCodeCorrect", () => {
  it("accepts the exact code", () => {
    expect(isAccessCodeCorrect(EXPECTED, EXPECTED)).toBe(true);
  });

  it("rejects a wrong code of the same length", () => {
    expect(isAccessCodeCorrect("WRONGGG-ACCESS-CODE", EXPECTED)).toBe(false);
  });

  it("rejects a code differing only in case", () => {
    // D-017 makes the field uppercase in the UI; the comparison itself is exact, so a
    // lowercase submission must not pass.
    expect(isAccessCodeCorrect(EXPECTED.toLowerCase(), EXPECTED)).toBe(false);
  });

  it("rejects a prefix of the correct code", () => {
    expect(isAccessCodeCorrect(EXPECTED.slice(0, -1), EXPECTED)).toBe(false);
  });

  it("rejects the correct code with a suffix appended", () => {
    expect(isAccessCodeCorrect(`${EXPECTED}X`, EXPECTED)).toBe(false);
  });

  it("rejects an empty submission", () => {
    expect(isAccessCodeCorrect("", EXPECTED)).toBe(false);
  });

  it("rejects everything when the expected code is empty", () => {
    // Otherwise an unset ACCESS_CODE would let any submission through. Config validation
    // already refuses to boot in that state; this is the second line of defence.
    expect(isAccessCodeCorrect("", "")).toBe(false);
    expect(isAccessCodeCorrect("anything", "")).toBe(false);
  });

  it("does not throw on a length mismatch", () => {
    // Hashing before comparison is what makes this safe — timingSafeEqual throws on
    // buffers of different lengths.
    expect(() => isAccessCodeCorrect("a", EXPECTED)).not.toThrow();
  });
});
