import { ConfigurationError, readAuthConfig } from "@/lib/config";

const VALID = {
  ACCESS_CODE: "CORRECT-ACCESS-CODE",
  SESSION_SECRET: "a-test-signing-secret-of-at-least-32-chars",
  WEB_ORIGIN: "http://localhost:3000",
};

describe("readAuthConfig", () => {
  it("reads a valid environment", () => {
    const config = readAuthConfig(VALID);

    expect(config.accessCode).toBe(VALID.ACCESS_CODE);
    expect(config.sessionSecret).toBe(VALID.SESSION_SECRET);
    expect(config.allowedOrigins).toEqual(["http://localhost:3000"]);
  });

  it("parses a comma-separated origin allow-list, trimming each entry", () => {
    const config = readAuthConfig({
      ...VALID,
      WEB_ORIGIN: "https://console.example.com , https://preview.example.com",
    });

    expect(config.allowedOrigins).toEqual([
      "https://console.example.com",
      "https://preview.example.com",
    ]);
  });
});

describe("readAuthConfig — negative cases", () => {
  it.each([
    ["ACCESS_CODE missing", { ...VALID, ACCESS_CODE: undefined }],
    ["ACCESS_CODE empty", { ...VALID, ACCESS_CODE: "" }],
    ["SESSION_SECRET missing", { ...VALID, SESSION_SECRET: undefined }],
    ["WEB_ORIGIN missing", { ...VALID, WEB_ORIGIN: undefined }],
    ["WEB_ORIGIN empty", { ...VALID, WEB_ORIGIN: "" }],
  ])("throws when %s", (_label, environment) => {
    expect(() => readAuthConfig(environment)).toThrow(ConfigurationError);
  });

  it("throws when SESSION_SECRET is shorter than HS256's 256-bit minimum", () => {
    expect(() =>
      readAuthConfig({ ...VALID, SESSION_SECRET: "too-short" }),
    ).toThrow(/at least 32 characters/);
  });

  it("throws when SESSION_SECRET equals ACCESS_CODE (D-008 requires distinct)", () => {
    // If they matched, anyone holding the access code could sign their own sessions.
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
