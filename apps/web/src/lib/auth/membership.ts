import {
  mintServiceToken,
  readApiOrigin,
  readSessionSecret,
} from "@/lib/auth/service-token";

export async function fetchMembership(
  lineUserId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<boolean | null> {
  try {
    const token = await mintServiceToken(
      { lineUserId, member: false },
      readSessionSecret(),
    );

    const response = await fetchImplementation(
      `${readApiOrigin()}/api/auth/membership`,
      {
        headers: { Authorization: `Bearer ${token}` },
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

    return typeof member === "boolean" ? member : null;
  } catch (error) {
    console.warn("[auth] membership read threw:", error);
    return null;
  }
}
