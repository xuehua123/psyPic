import { describe, expect, it } from "vitest";
import {
  createTempAssetFromBase64,
  readTempAssetForUser,
  resetTempAssetStore
} from "@/server/services/temp-asset-service";

describe("Temp asset object storage", () => {
  it("writes and reads temp assets through configured object storage", async () => {
    const previousDriver = process.env.ASSET_STORAGE_DRIVER;
    const previousPrefix = process.env.ASSET_STORAGE_PREFIX;
    const objects = new Map<string, Uint8Array>();
    const client = {
      putObject: async ({
        key,
        body
      }: {
        key: string;
        body: Uint8Array;
        contentType: string;
      }) => {
        objects.set(key, body);
      },
      getObject: async ({ key }: { key: string }) => {
        const object = objects.get(key);

        if (!object) {
          throw new Error("missing object");
        }

        return object;
      },
      deleteObject: async ({ key }: { key: string }) => {
        objects.delete(key);
      }
    };
    (
      globalThis as typeof globalThis & {
        __psypicObjectStorageClient?: typeof client;
      }
    ).__psypicObjectStorageClient = client;
    process.env.ASSET_STORAGE_DRIVER = "r2";
    process.env.ASSET_STORAGE_PREFIX = "psypic-test/";

    try {
      await resetTempAssetStore();
      const asset = await createTempAssetFromBase64({
        userId: "user_storage",
        taskId: "task_storage",
        b64Json: Buffer.from("object-storage-image").toString("base64"),
        format: "png"
      });
      const readable = await readTempAssetForUser(asset.id, "user_storage");

      expect(asset.temp_storage_key).toMatch(/^psypic-test\/temp-assets\//);
      expect(objects.has(asset.temp_storage_key)).toBe(true);
      expect(Buffer.from(readable.bytes).toString("utf8")).toBe(
        "object-storage-image"
      );
    } finally {
      await resetTempAssetStore();
      delete (
        globalThis as typeof globalThis & {
          __psypicObjectStorageClient?: unknown;
        }
      ).__psypicObjectStorageClient;
      restoreEnv("ASSET_STORAGE_DRIVER", previousDriver);
      restoreEnv("ASSET_STORAGE_PREFIX", previousPrefix);
    }
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
