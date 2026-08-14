import { fixedClock } from "@/lib/clock";
import type { AuthConfig } from "@/lib/config";
import { login, type AuthDependencies } from "@/lib/services/auth-service";
import { SESSION_LIFETIME_SECONDS } from "@/lib/services/session";

const NOW = new Date("2026-08-12T09:00:00.000Z");
const ACCESS_CODE = "CORRECT-ACCESS-CODE";
const SESSION_SECRET = "a-test-signing-secret-of-at-least-32-chars";

const CONFIG: AuthConfig = {
  accessCode: ACCESS_CODE,
  sessionSecret: SESSION_SECRET,
  allowedOrigins: ["http://localhost:3000"],
};

const DEPENDENCIES: AuthDependencies = {
  config: CONFIG,
  clock: fixedClock(NOW),
};

describe("login — positive path", () => {
  it("authenticates the correct code and issues a 7-day session", async () => {
    const result = await login({ code: ACCESS_CODE }, DEPENDENCIES);

    expect(result).toMatchObject({ outcome: "authenticated" });
    if (result.outcome !== "authenticated") throw new Error("unreachable");
    expect(result.expiresAt.getTime() - NOW.getTime()).toBe(
      SESSION_LIFETIME_SECONDS * 1000,
    );
  });

  it("accepts a code with surrounding whitespace", async () => {
    const result = await login({ code: `  ${ACCESS_CODE}  ` }, DEPENDENCIES);

    expect(result.outcome).toBe("authenticated");
  });
});

describe("login — negative paths", () => {
  it("rejects a wrong code with 'rejected'", async () => {
    const result = await login({ code: "NOPE" }, DEPENDENCIES);

    expect(result).toEqual({ outcome: "rejected" });
  });

  it("treats an empty code as an invalid request", async () => {
    const result = await login({ code: "" }, DEPENDENCIES);

    expect(result).toEqual({ outcome: "invalid-request" });
  });

  it("treats a whitespace-only code as an invalid request", async () => {
    await expect(login({ code: "   " }, DEPENDENCIES)).resolves.toEqual({
      outcome: "invalid-request",
    });
  });

  it.each([
    ["a missing code", undefined],
    ["a null code", null],
    ["a numeric code", 12345],
    ["an object code", { code: ACCESS_CODE }],
    ["an array code", [ACCESS_CODE]],
    ["a boolean code", true],
  ])("rejects %s as an invalid request", async (_label, code) => {
    await expect(login({ code }, DEPENDENCIES)).resolves.toEqual({
      outcome: "invalid-request",
    });
  });

  it("rejects a code longer than the contract's 128-character bound", async () => {
    await expect(
      login({ code: "X".repeat(129) }, DEPENDENCIES),
    ).resolves.toEqual({ outcome: "invalid-request" });
  });
});
