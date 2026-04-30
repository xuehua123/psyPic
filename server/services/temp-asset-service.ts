import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createId } from "@/server/services/key-binding-service";

export type TempAsset = {
  id: string;
  user_id: string;
  task_id: string;
  mime_type: string;
  width?: number;
  height?: number;
  size_bytes: number;
  temp_storage_key: string;
  expires_at: string;
  created_at: string;
};

type ReadableTempAsset = TempAsset & {
  bytes: Uint8Array;
};

type TempAssetErrorCode = "not_found" | "forbidden" | "expired";

export class TempAssetError extends Error {
  code: TempAssetErrorCode;

  constructor(code: TempAssetErrorCode, message: string) {
    super(message);
    this.name = "TempAssetError";
    this.code = code;
  }
}

declare global {
  var __psypicTempAssets: Map<string, TempAsset> | undefined;
}

const tempAssets = globalThis.__psypicTempAssets ?? new Map<string, TempAsset>();
globalThis.__psypicTempAssets = tempAssets;

export async function createTempAssetFromBase64(input: {
  userId: string;
  taskId: string;
  b64Json: string;
  format: "png" | "jpeg" | "webp";
  width?: number;
  height?: number;
}) {
  const bytes = Buffer.from(input.b64Json, "base64");
  const id = createId("asset");
  const now = new Date();
  const ttlHours = Number(process.env.TEMP_ASSET_TTL_HOURS ?? 72);
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const filename = `${id}.${input.format === "jpeg" ? "jpg" : input.format}`;
  const storageDir = getTempAssetRoot();
  const storagePath = getTempAssetPath(filename);

  await mkdir(/* turbopackIgnore: true */ storageDir, { recursive: true });
  await writeFile(/* turbopackIgnore: true */ storagePath, bytes);

  const asset: TempAsset = {
    id,
    user_id: input.userId,
    task_id: input.taskId,
    mime_type: mimeTypeForFormat(input.format),
    width: input.width,
    height: input.height,
    size_bytes: bytes.byteLength,
    temp_storage_key: filename,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString()
  };

  tempAssets.set(asset.id, asset);
  return asset;
}

export async function readTempAssetForUser(
  assetId: string,
  userId: string
): Promise<ReadableTempAsset> {
  const asset = tempAssets.get(assetId);

  if (!asset) {
    throw new TempAssetError("not_found", "临时资产不存在");
  }

  if (asset.user_id !== userId) {
    throw new TempAssetError("forbidden", "无权访问该资产");
  }

  if (new Date(asset.expires_at).getTime() <= Date.now()) {
    throw new TempAssetError("expired", "临时资产已过期");
  }

  return {
    ...asset,
    bytes: await readFile(
      /* turbopackIgnore: true */ getTempAssetPath(asset.temp_storage_key)
    )
  };
}

export async function resetTempAssetStore() {
  tempAssets.clear();
  await rm(/* turbopackIgnore: true */ getTempAssetRoot(), {
    recursive: true,
    force: true
  });
}

function getTempAssetRoot() {
  const workerId = process.env.VITEST_WORKER_ID;
  const baseRoot = path.join(process.cwd(), "output", "temp-assets");

  if (workerId) {
    return path.join(baseRoot, `worker-${workerId.replace(/\W/g, "_")}`);
  }

  return baseRoot;
}

function getTempAssetPath(storageKey: string) {
  return path.join(process.cwd(), "output", "temp-assets", storageKey);
}

function mimeTypeForFormat(format: "png" | "jpeg" | "webp") {
  if (format === "jpeg") {
    return "image/jpeg";
  }

  return `image/${format}`;
}
