import { describe, expect, it } from "vitest";
import {
  createTempAssetFromBase64,
  readTempAssetForUser,
  resetTempAssetStore
} from "@/server/services/temp-asset-service";

describe("TempAsset service", () => {
  it("stores generated image bytes and enforces owner access", async () => {
    await resetTempAssetStore();
    const imageBytes = Buffer.from("image-bytes");

    const asset = await createTempAssetFromBase64({
      userId: "user_owner",
      taskId: "task_123",
      b64Json: imageBytes.toString("base64"),
      format: "png"
    });

    expect(asset.id).toMatch(/^asset_/);
    expect(asset.mime_type).toBe("image/png");
    expect(asset.size_bytes).toBe(imageBytes.byteLength);
    expect(asset.temp_storage_key).toBe(`${asset.id}.png`);

    const readable = await readTempAssetForUser(asset.id, "user_owner");
    expect(Buffer.from(readable.bytes).toString()).toBe("image-bytes");

    await expect(readTempAssetForUser(asset.id, "other_user")).rejects.toMatchObject({
      code: "forbidden"
    });
  });
});
