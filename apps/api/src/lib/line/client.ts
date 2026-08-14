const LINE_API_ORIGIN = "https://api.line.me";
const LINE_DATA_API_ORIGIN = "https://api-data.line.me";

export interface LineProfile {
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface LineContent {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface LineClient {
  fetchProfile(lineUserId: string): Promise<LineProfile | null>;

  replyMessage(replyToken: string, text: string): Promise<boolean>;

  pushMessage(lineUserId: string, text: string): Promise<boolean>;

  fetchContent(lineMessageId: string): Promise<LineContent | null>;

  replyImage(replyToken: string, imageUrl: string): Promise<boolean>;

  pushImage(lineUserId: string, imageUrl: string): Promise<boolean>;
}

export function createLineClient(
  channelAccessToken: string,
  fetchImplementation: typeof fetch = fetch,
): LineClient {
  async function postMessage(
    endpoint: string,
    body: Record<string, unknown>,
    logLabel: string,
  ): Promise<boolean> {
    try {
      const response = await fetchImplementation(
        `${LINE_API_ORIGIN}${endpoint}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${channelAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        console.warn(`[line] ${logLabel} failed: ${response.status}`);
        return false;
      }

      return true;
    } catch (error) {
      console.warn(`[line] ${logLabel} threw:`, error);
      return false;
    }
  }

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
        console.warn(`[line] profile fetch threw for ${lineUserId}:`, error);
        return null;
      }
    },

    async replyMessage(replyToken: string, text: string): Promise<boolean> {
      return postMessage(
        "/v2/bot/message/reply",
        { replyToken, messages: [{ type: "text", text }] },
        "reply",
      );
    },

    async pushMessage(lineUserId: string, text: string): Promise<boolean> {
      return postMessage(
        "/v2/bot/message/push",
        { to: lineUserId, messages: [{ type: "text", text }] },
        "push",
      );
    },

    async fetchContent(lineMessageId: string): Promise<LineContent | null> {
      try {
        const response = await fetchImplementation(
          `${LINE_DATA_API_ORIGIN}/v2/bot/message/${encodeURIComponent(lineMessageId)}/content`,
          { headers: { Authorization: `Bearer ${channelAccessToken}` } },
        );

        if (!response.ok) {
          console.warn(
            `[line] content fetch failed for ${lineMessageId}: ${response.status}`,
          );
          return null;
        }

        const contentType =
          response.headers.get("content-type") ?? "application/octet-stream";
        const bytes = new Uint8Array(await response.arrayBuffer());

        return { bytes, contentType };
      } catch (error) {
        console.warn(`[line] content fetch threw for ${lineMessageId}:`, error);
        return null;
      }
    },

    async replyImage(replyToken: string, imageUrl: string): Promise<boolean> {
      return postMessage(
        "/v2/bot/message/reply",
        {
          replyToken,
          messages: [
            {
              type: "image",
              originalContentUrl: imageUrl,
              previewImageUrl: imageUrl,
            },
          ],
        },
        "reply image",
      );
    },

    async pushImage(lineUserId: string, imageUrl: string): Promise<boolean> {
      return postMessage(
        "/v2/bot/message/push",
        {
          to: lineUserId,
          messages: [
            {
              type: "image",
              originalContentUrl: imageUrl,
              previewImageUrl: imageUrl,
            },
          ],
        },
        "push image",
      );
    },
  };
}

function readProfile(body: unknown): LineProfile | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { displayName, pictureUrl } = body as Record<string, unknown>;

  if (typeof displayName !== "string" || displayName.length === 0) {
    return null;
  }

  return {
    displayName,
    avatarUrl: typeof pictureUrl === "string" ? pictureUrl : null,
  };
}
