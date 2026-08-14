/**
 * D-053: the LINE client is plain `fetch` over exactly the endpoints this product uses.
 * No SDK. Declared as a narrow port and injected, so every service test uses a double and
 * no test performs a network call (AGENTS.md, Dependency Inversion).
 */

const LINE_API_ORIGIN = "https://api.line.me";

export interface LineProfile {
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

/**
 * The port. T-006 needs only `fetchProfile`; T-008 will add reply and push to this same
 * interface rather than opening a second client.
 */
export interface LineClient {
  /**
   * D-013: fetched when a contact first messages the OA, then cached in Postgres.
   *
   * Returns `null` on ANY failure — a profile fetch must never block storing the inbound
   * message, so the caller falls back to the LINE user id. Failures are logged here rather
   * than thrown, because there is no caller that could do anything useful with the error.
   */
  fetchProfile(lineUserId: string): Promise<LineProfile | null>;
}

export function createLineClient(
  channelAccessToken: string,
  fetchImplementation: typeof fetch = fetch,
): LineClient {
  return {
    async fetchProfile(lineUserId: string): Promise<LineProfile | null> {
      try {
        const response = await fetchImplementation(
          `${LINE_API_ORIGIN}/v2/bot/profile/${encodeURIComponent(lineUserId)}`,
          { headers: { Authorization: `Bearer ${channelAccessToken}` } },
        );

        if (!response.ok) {
          console.warn(
            `[line] profile fetch failed for ${lineUserId}: ${response.status}`,
          );
          return null;
        }

        const body: unknown = await response.json();

        return readProfile(body);
      } catch (error) {
        // Network failure, DNS, timeout, invalid JSON — all the same to the caller.
        console.warn(`[line] profile fetch threw for ${lineUserId}:`, error);
        return null;
      }
    },
  };
}

function readProfile(body: unknown): LineProfile | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { displayName, pictureUrl } = body as Record<string, unknown>;

  // A 200 with no usable display name is treated as a failure, so the caller takes the
  // recorded LINE-user-id fallback rather than storing an empty name.
  if (typeof displayName !== "string" || displayName.length === 0) {
    return null;
  }

  return {
    displayName,
    avatarUrl: typeof pictureUrl === "string" ? pictureUrl : null,
  };
}
