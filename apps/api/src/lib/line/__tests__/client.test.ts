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
      // The caller stores the message either way and falls back to the LINE user id. A
      // throw here would take the whole webhook down and make LINE retry forever.
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
    // A 200 with no usable name is a failure, so the caller takes the recorded LINE-user-id
    // fallback rather than storing an empty contact name.
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
