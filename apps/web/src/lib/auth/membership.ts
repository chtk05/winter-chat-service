import {
  mintServiceToken,
  readApiOrigin,
  readSessionSecret,
} from "@/lib/auth/service-token";

/**
 * D-054: the authoritative membership read.
 *
 * The Auth.js `jwt` callback must NOT trust its own update payload — `trigger: "update"`
 * fires for a browser calling `useSession().update()`, so believing `session.member` would
 * let any LINE-authenticated user grant themselves membership without the join code. This
 * asks `apps/api`, which owns the database, instead.
 *
 * Called once per `update` trigger — right after a join — never per request. Ordinary page
 * loads and proxied calls read the claim straight from the token, which is what D-046 buys.
 */
export async function fetchMembership(
  lineUserId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<boolean | null> {
  try {
    const token = await mintServiceToken(
      // A `member: false` token is exactly the kind that needs this endpoint, and
      // `/api/auth/membership` is members-optional for that reason (D-054).
      { lineUserId, member: false },
      readSessionSecret(),
    );

    const response = await fetchImplementation(
      `${readApiOrigin()}/api/auth/membership`,
      {
        headers: { Authorization: `Bearer ${token}` },
        // Never cached: the whole point is to observe a change that just happened.
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.warn(`[auth] membership read failed: ${response.status}`);
      return null;
    }

    const body: unknown = await response.json();

    if (typeof body !== "object" || body === null) {
      return null;
    }

    const { member } = body as Record<string, unknown>;

    // Strictly boolean. Anything else is a contract violation, not a false.
    return typeof member === "boolean" ? member : null;
  } catch (error) {
    console.warn("[auth] membership read threw:", error);
    return null;
  }
}
