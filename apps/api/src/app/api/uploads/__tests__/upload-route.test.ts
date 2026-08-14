import { NextRequest } from "next/server";

import { POST } from "@/app/api/uploads/route";
import { createStorageClient } from "@/lib/storage/client";

jest.mock("@/lib/storage/client", () => ({ createStorageClient: jest.fn() }));

const createStorageClientMock = createStorageClient as jest.Mock;

function requestWithFile(file: File | null, fieldName = "file"): NextRequest {
  const formData = new FormData();
  if (file) {
    formData.set(fieldName, file);
  }
  return new NextRequest("http://api.test/api/uploads", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  createStorageClientMock.mockReturnValue({
    async upload({ bucket, path }: { bucket: string; path: string }) {
      return {
        url: `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}`,
      };
    },
  });
});

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("POST /uploads — positive cases (D-058)", () => {
  it("201s with the public url for a valid image", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", {
      type: "image/jpeg",
    });

    const response = await POST(requestWithFile(file));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.url).toMatch(
      /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/chat-media\/outbound\//,
    );
  });

  it("accepts each allowed image mime type", async () => {
    for (const type of ["image/jpeg", "image/png", "image/gif", "image/webp"]) {
      const file = new File([new Uint8Array([1])], "x", { type });
      const response = await POST(requestWithFile(file));
      expect(response.status).toBe(201);
    }
  });
});

describe("POST /uploads — negative cases required by D-058", () => {
  it("400s when no file field is present", async () => {
    const response = await POST(requestWithFile(null));
    expect(response.status).toBe(400);
  });

  it("400s for a non-multipart body rather than throwing", async () => {
    const request = new NextRequest("http://api.test/api/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not multipart",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("400s for a disallowed mime type", async () => {
    const file = new File([new Uint8Array([1])], "doc.pdf", {
      type: "application/pdf",
    });

    const response = await POST(requestWithFile(file));
    expect(response.status).toBe(400);
  });

  it("400s for an empty file", async () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });

    const response = await POST(requestWithFile(file));
    expect(response.status).toBe(400);
  });

  it("400s for a file over the 10MB limit", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });

    const response = await POST(requestWithFile(file));
    expect(response.status).toBe(400);
  });

  it("accepts a file at exactly the 10MB boundary", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024)], "max.jpg", {
      type: "image/jpeg",
    });

    const response = await POST(requestWithFile(file));
    expect(response.status).toBe(201);
  });

  it("502s with UPLOAD_FAILED when storage refuses the upload", async () => {
    createStorageClientMock.mockReturnValue({
      async upload() {
        return null;
      },
    });
    const file = new File([new Uint8Array([1])], "photo.jpg", {
      type: "image/jpeg",
    });

    const response = await POST(requestWithFile(file));

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("UPLOAD_FAILED");
  });

  it("500s with SERVER_MISCONFIGURED when Supabase env vars are absent, never touches storage", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const file = new File([new Uint8Array([1])], "photo.jpg", {
      type: "image/jpeg",
    });

    const response = await POST(requestWithFile(file));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("SERVER_MISCONFIGURED");
    expect(createStorageClientMock).not.toHaveBeenCalled();
  });
});
