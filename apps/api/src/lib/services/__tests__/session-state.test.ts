import { fixedClock } from "@/lib/clock";
import type { AuthConfig } from "@/lib/config";
import { describeSession } from "@/lib/services/session-state";
import { SESSION_LIFETIME_SECONDS, issueSession } from "@/lib/services/session";

const NOW = new Date("2026-08-12T09:00:00.000Z");
const SESSION_SECRET = "a-test-signing-secret-of-at-least-32-chars";

const CONFIG: AuthConfig = {
  accessCode: "CORRECT-ACCESS-CODE",
  sessionSecret: SESSION_SECRET,
  allowedOrigins: ["http://localhost:3000"],
};

describe("describeSession", () => {
  it("reports an authenticated session for a freshly issued token", async () => {
    const clock = fixedClock(NOW);
    const { token } = await issueSession(SESSION_SECRET, clock);

    await expect(
      describeSession(token, { config: CONFIG, clock }),
    ).resolves.toEqual({
      authenticated: true,
      expiresAt: new Date(NOW.getTime() + SESSION_LIFETIME_SECONDS * 1000),
    });
  });

  it.each([
    ["no cookie", undefined],
    ["an empty cookie", ""],
    ["a malformed cookie", "garbage"],
  ])("reports unauthenticated for %s", async (_label, token) => {
    await expect(
      describeSession(token, { config: CONFIG, clock: fixedClock(NOW) }),
    ).resolves.toEqual({ authenticated: false });
  });

  it("reports unauthenticated for a cookie signed with a rotated secret", async () => {
    const clock = fixedClock(NOW);
    const { token } = await issueSession(
      "a-completely-different-secret-32-chars",
      clock,
    );

    await expect(
      describeSession(token, { config: CONFIG, clock }),
    ).resolves.toEqual({ authenticated: false });
  });

  it("reports unauthenticated once the session has expired", async () => {
    const { token } = await issueSession(SESSION_SECRET, fixedClock(NOW));
    const afterExpiry = fixedClock(
      new Date(NOW.getTime() + (SESSION_LIFETIME_SECONDS + 1) * 1000),
    );

    await expect(
      describeSession(token, { config: CONFIG, clock: afterExpiry }),
    ).resolves.toEqual({ authenticated: false });
  });
});
