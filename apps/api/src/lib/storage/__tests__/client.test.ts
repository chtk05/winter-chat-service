import { createStorageClient } from "@/lib/storage/client";

const CONFIG = {
  url: "https://project.supabase.co",
  serviceRoleKey: "service-role-key",
};

let warn: jest.SpyInstance;

beforeEach(() => {
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => warn.mockRestore());

describe("createStorageClient.upload — positive cases (D-058)", () => {
  it("returns the public url on a 200", async () => {
    const fetchDouble = jest.fn(
      async () => new Response(null, { status: 200 }),
    );

    const client = createStorageClient(
      CONFIG,
      fetchDouble as unknown as typeof fetch,
    );

    await expect(
      client.upload({
        bucket: "chat-media",
        path: "inbound/msg-1.jpg",
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "image/jpeg",
      }),
    ).resolves.toEqual({
      url: "https://project.supabase.co/storage/v1/object/public/chat-media/inbound/msg-1.jpg",
    });
  });

  it("calls the documented object endpoint with a Bearer service-role token and upsert", async () => {
    const fetchDouble = jest.fn(
      async () => new Response(null, { status: 200 }),
    );

    await createStorageClient(
      CONFIG,
      fetchDouble as unknown as typeof fetch,
    ).upload({
      bucket: "chat-media",
      path: "outbound/x.png",
      bytes: new Uint8Array([9]),
      contentType: "image/png",
    });

    expect(fetchDouble).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1/object/chat-media/outbound/x.png",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: `Bearer ${CONFIG.serviceRoleKey}`,
          "Content-Type": "image/png",
          "x-upsert": "true",
        },
      }),
    );
  });
});

describe("createStorageClient.upload — failure paths D-058's resilience depends on", () => {
  it.each([400, 401, 403, 404, 413, 500])(
    "returns null on HTTP %s rather than throwing",
    async (status) => {
      const fetchDouble = jest.fn(async () => new Response(null, { status }));

      await expect(
        createStorageClient(
          CONFIG,
          fetchDouble as unknown as typeof fetch,
        ).upload({
          bucket: "chat-media",
          path: "inbound/x.jpg",
          bytes: new Uint8Array([1]),
          contentType: "image/jpeg",
        }),
      ).resolves.toBeNull();
    },
  );

  it("returns null when fetch itself rejects (network failure)", async () => {
    const fetchDouble = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    await expect(
      createStorageClient(
        CONFIG,
        fetchDouble as unknown as typeof fetch,
      ).upload({
        bucket: "chat-media",
        path: "inbound/x.jpg",
        bytes: new Uint8Array([1]),
        contentType: "image/jpeg",
      }),
    ).resolves.toBeNull();
  });

  it("never lets the service role key reach the log on failure (D-001: public repo)", async () => {
    const fetchDouble = jest.fn(
      async () => new Response(null, { status: 401 }),
    );

    await createStorageClient(
      CONFIG,
      fetchDouble as unknown as typeof fetch,
    ).upload({
      bucket: "chat-media",
      path: "inbound/x.jpg",
      bytes: new Uint8Array([1]),
      contentType: "image/jpeg",
    });

    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(CONFIG.serviceRoleKey);
  });
});
