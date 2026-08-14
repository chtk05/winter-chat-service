import { createLineClient } from "@/lib/line/client";

const TOKEN = "channel-access-token";
const LINE_USER_ID = "U8f2c000000000000000000000000004471";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let warn: jest.SpyInstance;

beforeEach(() => {
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => warn.mockRestore());

describe("createLineClient.fetchProfile — positive cases (D-013, D-053)", () => {
  it("returns the display name and avatar", async () => {
    const fetchDouble = jest.fn(async () =>
      jsonResponse(200, {
        displayName: "Nattapong",
        pictureUrl: "https://line/pic.jpg",
      }),
    );

    const client = createLineClient(
      TOKEN,
      fetchDouble as unknown as typeof fetch,
    );

    await expect(client.fetchProfile(LINE_USER_ID)).resolves.toEqual({
      displayName: "Nattapong",
      avatarUrl: "https://line/pic.jpg",
    });
  });

  it("calls the documented endpoint with a Bearer token", async () => {
    const fetchDouble = jest.fn(async () =>
      jsonResponse(200, { displayName: "Aom" }),
    );

    await createLineClient(
      TOKEN,
      fetchDouble as unknown as typeof fetch,
    ).fetchProfile(LINE_USER_ID);

    expect(fetchDouble).toHaveBeenCalledWith(
      `https://api.line.me/v2/bot/profile/${LINE_USER_ID}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it("URL-encodes the user id rather than interpolating it raw", async () => {
    const fetchDouble = jest.fn(async () =>
      jsonResponse(200, { displayName: "Aom" }),
    );

    await createLineClient(
      TOKEN,
      fetchDouble as unknown as typeof fetch,
    ).fetchProfile("U/../../admin");

    expect((fetchDouble.mock.calls as unknown as string[][])[0][0]).toBe(
      "https://api.line.me/v2/bot/profile/U%2F..%2F..%2Fadmin",
    );
  });

  it("returns a null avatar when the profile carries no picture", async () => {
    const fetchDouble = jest.fn(async () =>
      jsonResponse(200, { displayName: "Aom" }),
    );

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).fetchProfile(LINE_USER_ID),
    ).resolves.toEqual({ displayName: "Aom", avatarUrl: null });
  });
});

describe("createLineClient.fetchProfile — failure paths D-013's fallback depends on", () => {
  it.each([400, 401, 403, 404, 429, 500, 503])(
    "returns null on HTTP %s rather than throwing",
    async (status) => {
      const fetchDouble = jest.fn(async () => jsonResponse(status, {}));

      await expect(
        createLineClient(
          TOKEN,
          fetchDouble as unknown as typeof fetch,
        ).fetchProfile(LINE_USER_ID),
      ).resolves.toBeNull();
    },
  );

  it("returns null when fetch itself rejects (network failure)", async () => {
    const fetchDouble = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).fetchProfile(LINE_USER_ID),
    ).resolves.toBeNull();
  });

  it("returns null when the body is not JSON", async () => {
    const fetchDouble = jest.fn(
      async () => new Response("<html>gateway error</html>", { status: 200 }),
    );

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).fetchProfile(LINE_USER_ID),
    ).resolves.toBeNull();
  });

  it.each([
    ["no displayName", { pictureUrl: "https://line/pic.jpg" }],
    ["an empty displayName", { displayName: "" }],
    ["a non-string displayName", { displayName: 42 }],
    ["a JSON array", []],
    ["JSON null", null],
  ])("returns null for a 200 carrying %s", async (_label, payload) => {
    const fetchDouble = jest.fn(async () => jsonResponse(200, payload));

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).fetchProfile(LINE_USER_ID),
    ).resolves.toBeNull();
  });

  it("ignores a non-string pictureUrl rather than passing it through", async () => {
    const fetchDouble = jest.fn(async () =>
      jsonResponse(200, { displayName: "Aom", pictureUrl: 12345 }),
    );

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).fetchProfile(LINE_USER_ID),
    ).resolves.toEqual({ displayName: "Aom", avatarUrl: null });
  });

  it("never lets the access token reach the log on failure (D-001: public repo)", async () => {
    const fetchDouble = jest.fn(async () => jsonResponse(401, {}));

    await createLineClient(
      TOKEN,
      fetchDouble as unknown as typeof fetch,
    ).fetchProfile(LINE_USER_ID);

    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(TOKEN);
  });
});

describe("createLineClient.replyMessage — T-008, D-003, D-006", () => {
  it("returns true on a 200 and calls the documented Reply endpoint", async () => {
    const fetchDouble = jest.fn(async () => jsonResponse(200, {}));

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).replyMessage("reply-token-1", "hello"),
    ).resolves.toBe(true);

    expect(fetchDouble).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/reply",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          replyToken: "reply-token-1",
          messages: [{ type: "text", text: "hello" }],
        }),
      },
    );
  });

  it.each([400, 401, 403, 429, 500])(
    "returns false on HTTP %s rather than throwing",
    async (status) => {
      const fetchDouble = jest.fn(async () => jsonResponse(status, {}));

      await expect(
        createLineClient(
          TOKEN,
          fetchDouble as unknown as typeof fetch,
        ).replyMessage("reply-token-1", "hello"),
      ).resolves.toBe(false);
    },
  );

  it("returns false when fetch itself rejects (network failure)", async () => {
    const fetchDouble = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).replyMessage("reply-token-1", "hello"),
    ).resolves.toBe(false);
  });

  it("never lets the access token reach the log on failure", async () => {
    const fetchDouble = jest.fn(async () => jsonResponse(400, {}));

    await createLineClient(
      TOKEN,
      fetchDouble as unknown as typeof fetch,
    ).replyMessage("reply-token-1", "hello");

    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(TOKEN);
  });
});

describe("createLineClient.pushMessage — T-008, D-003, D-006", () => {
  it("returns true on a 200 and calls the documented Push endpoint", async () => {
    const fetchDouble = jest.fn(async () => jsonResponse(200, {}));

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).pushMessage(LINE_USER_ID, "hello"),
    ).resolves.toBe(true);

    expect(fetchDouble).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: LINE_USER_ID,
          messages: [{ type: "text", text: "hello" }],
        }),
      },
    );
  });

  it.each([400, 401, 403, 429, 500])(
    "returns false on HTTP %s rather than throwing",
    async (status) => {
      const fetchDouble = jest.fn(async () => jsonResponse(status, {}));

      await expect(
        createLineClient(
          TOKEN,
          fetchDouble as unknown as typeof fetch,
        ).pushMessage(LINE_USER_ID, "hello"),
      ).resolves.toBe(false);
    },
  );

  it("returns false when fetch itself rejects (network failure)", async () => {
    const fetchDouble = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).pushMessage(LINE_USER_ID, "hello"),
    ).resolves.toBe(false);
  });
});

describe("createLineClient.fetchContent — D-058", () => {
  it("returns the bytes and content-type on a 200", async () => {
    const fetchDouble = jest.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
    );

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).fetchContent("msg-1"),
    ).resolves.toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
  });

  it("calls the documented Content API endpoint on api-data.line.me, not api.line.me", async () => {
    const fetchDouble = jest.fn(
      async () => new Response(new Uint8Array(), { status: 200 }),
    );

    await createLineClient(
      TOKEN,
      fetchDouble as unknown as typeof fetch,
    ).fetchContent("msg-1");

    expect(fetchDouble).toHaveBeenCalledWith(
      "https://api-data.line.me/v2/bot/message/msg-1/content",
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it("falls back to application/octet-stream when no content-type header is sent", async () => {
    const fetchDouble = jest.fn(
      async () => new Response(new Uint8Array([1]), { status: 200 }),
    );

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).fetchContent("msg-1"),
    ).resolves.toEqual({
      bytes: new Uint8Array([1]),
      contentType: "application/octet-stream",
    });
  });

  it.each([400, 401, 404, 410, 500])(
    "returns null on HTTP %s rather than throwing",
    async (status) => {
      const fetchDouble = jest.fn(async () => new Response(null, { status }));

      await expect(
        createLineClient(
          TOKEN,
          fetchDouble as unknown as typeof fetch,
        ).fetchContent("msg-1"),
      ).resolves.toBeNull();
    },
  );

  it("returns null when fetch itself rejects (network failure)", async () => {
    const fetchDouble = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).fetchContent("msg-1"),
    ).resolves.toBeNull();
  });

  it("never lets the access token reach the log on failure", async () => {
    const fetchDouble = jest.fn(
      async () => new Response(null, { status: 401 }),
    );

    await createLineClient(
      TOKEN,
      fetchDouble as unknown as typeof fetch,
    ).fetchContent("msg-1");

    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(TOKEN);
  });
});

describe("createLineClient.replyImage / pushImage — D-058", () => {
  const IMAGE_URL = "https://storage.test/chat-media/outbound/x.jpg";

  it("replyImage sends the SAME url as both originalContentUrl and previewImageUrl", async () => {
    const fetchDouble = jest.fn(async () => jsonResponse(200, {}));

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).replyImage("reply-token-1", IMAGE_URL),
    ).resolves.toBe(true);

    expect(fetchDouble).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/reply",
      expect.objectContaining({
        body: JSON.stringify({
          replyToken: "reply-token-1",
          messages: [
            {
              type: "image",
              originalContentUrl: IMAGE_URL,
              previewImageUrl: IMAGE_URL,
            },
          ],
        }),
      }),
    );
  });

  it("pushImage calls the push endpoint with the recipient and the image", async () => {
    const fetchDouble = jest.fn(async () => jsonResponse(200, {}));

    await expect(
      createLineClient(TOKEN, fetchDouble as unknown as typeof fetch).pushImage(
        LINE_USER_ID,
        IMAGE_URL,
      ),
    ).resolves.toBe(true);

    expect(fetchDouble).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      expect.objectContaining({
        body: JSON.stringify({
          to: LINE_USER_ID,
          messages: [
            {
              type: "image",
              originalContentUrl: IMAGE_URL,
              previewImageUrl: IMAGE_URL,
            },
          ],
        }),
      }),
    );
  });

  it("replyImage returns false on a non-2xx rather than throwing", async () => {
    const fetchDouble = jest.fn(async () => jsonResponse(400, {}));

    await expect(
      createLineClient(
        TOKEN,
        fetchDouble as unknown as typeof fetch,
      ).replyImage("reply-token-1", IMAGE_URL),
    ).resolves.toBe(false);
  });

  it("pushImage returns false on a non-2xx rather than throwing", async () => {
    const fetchDouble = jest.fn(async () => jsonResponse(400, {}));

    await expect(
      createLineClient(TOKEN, fetchDouble as unknown as typeof fetch).pushImage(
        LINE_USER_ID,
        IMAGE_URL,
      ),
    ).resolves.toBe(false);
  });
});
