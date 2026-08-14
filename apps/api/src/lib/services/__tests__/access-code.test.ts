import { isAccessCodeCorrect } from "@/lib/services/access-code";

const EXPECTED = "CORRECT-ACCESS-CODE";

describe("isAccessCodeCorrect", () => {
  it("accepts the exact code", () => {
    expect(isAccessCodeCorrect(EXPECTED, EXPECTED)).toBe(true);
  });

  it("rejects a wrong code of the same length", () => {
    expect(isAccessCodeCorrect("WRONGGG-ACCESS-CODE", EXPECTED)).toBe(false);
  });

  it("accepts a code differing only in case — the join input's uppercase display is cosmetic, not a real transform", () => {
    expect(isAccessCodeCorrect(EXPECTED.toLowerCase(), EXPECTED)).toBe(true);
    expect(isAccessCodeCorrect("CoRrEcT-aCcEsS-cOdE", EXPECTED)).toBe(true);
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
    expect(isAccessCodeCorrect("", "")).toBe(false);
    expect(isAccessCodeCorrect("anything", "")).toBe(false);
  });

  it("does not throw on a length mismatch", () => {
    expect(() => isAccessCodeCorrect("a", EXPECTED)).not.toThrow();
  });
});
