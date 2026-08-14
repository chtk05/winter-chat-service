import type { StorageConfig } from "@/lib/config";

export interface StorageClient {
  upload(args: {
    bucket: string;
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ url: string } | null>;
}

export function createStorageClient(
  config: StorageConfig,
  fetchImplementation: typeof fetch = fetch,
): StorageClient {
  return {
    async upload({ bucket, path, bytes, contentType }) {
      try {
        const response = await fetchImplementation(
          `${config.url}/storage/v1/object/${bucket}/${encodeURI(path)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.serviceRoleKey}`,
              "Content-Type": contentType,
              "x-upsert": "true",
            },
            body: Buffer.from(bytes),
          },
        );

        if (!response.ok) {
          console.warn(`[storage] upload failed: ${response.status}`);
          return null;
        }

        return {
          url: `${config.url}/storage/v1/object/public/${bucket}/${encodeURI(path)}`,
        };
      } catch (error) {
        console.warn("[storage] upload threw:", error);
        return null;
      }
    },
  };
}
