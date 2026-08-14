import { ConfigurationError, readAuthConfig } from "@/lib/config";

const VALID = {
  ACCESS_CODE: "CORRECT-JOIN-CODE",
  SESSION_SECRET: "a-test-signing-secret-of-at-least-32-chars",
};

describe("readAuthConfig", () => {
  it("reads a valid environment", () => {
    const config = readAuthConfig(VALID);

    expect(config.accessCode).toBe(VALID.ACCESS_CODE);
    expect(config.sessionSecret).toBe(VALID.SESSION_SECRET);
  });

  it("ignores WEB_ORIGIN, which D-040 retired along with cors.ts", () => {
    const config = readAuthConfig({
      ...VALID,
      WEB_ORIGIN: "http://localhost:3000",
    });

    expect(config).toEqual({
      accessCode: VALID.ACCESS_CODE,
      sessionSecret: VALID.SESSION_SECRET,
    });
    expect(config).not.toHaveProperty("allowedOrigins");
  });
});

describe("readAuthConfig — negative cases", () => {
  it.each([
    ["ACCESS_CODE missing", { ...VALID, ACCESS_CODE: undefined }],
    ["ACCESS_CODE empty", { ...VALID, ACCESS_CODE: "" }],
    ["SESSION_SECRET missing", { ...VALID, SESSION_SECRET: undefined }],
    ["SESSION_SECRET empty", { ...VALID, SESSION_SECRET: "" }],
  ])("throws when %s", (_label, environment) => {
    expect(() => readAuthConfig(environment)).toThrow(ConfigurationError);
  });

  it("throws when SESSION_SECRET is shorter than HS256's 256-bit minimum", () => {
    expect(() =>
      readAuthConfig({ ...VALID, SESSION_SECRET: "too-short" }),
    ).toThrow(/at least 32 characters/);
  });

  it("throws when SESSION_SECRET equals ACCESS_CODE (D-008 requires distinct)", () => {
    const shared = "the-same-value-used-for-both-of-them!!";

    expect(() =>
      readAuthConfig({ ...VALID, ACCESS_CODE: shared, SESSION_SECRET: shared }),
    ).toThrow(/distinct/);
  });

  it("never puts a secret value in the error message (D-001: public repo)", () => {
    let message = "";
    try {
      readAuthConfig({ ...VALID, SESSION_SECRET: "too-short" });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("SESSION_SECRET");
    expect(message).not.toContain("too-short");
  });
});
