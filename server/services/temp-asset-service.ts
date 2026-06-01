import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { createId } from "@/server/services/key-binding-service";
import { createPostgresPrismaClient } from "@/server/services/prisma-client-factory";

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

type PersistedAssetRow = {
  id: string;
  userId: string;
  taskId: string | null;
  storageKey: string | null;
  mimeType: string | null;
  format: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  createdAt: Date;
};

type TempAssetErrorCode = "not_found" | "forbidden" | "expired";

type ObjectStorageClient = {
  putObject(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<void>;
  getObject(input: { key: string }): Promise<Uint8Array>;
  deleteObject?(input: { key: string }): Promise<void>;
};

type PersistedAssetClient = {
  imageAsset: {
    findFirst(input: Record<string, unknown>): Promise<PersistedAssetRow | null>;
  };
};

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
  var __psypicObjectStorageClient: ObjectStorageClient | undefined;
  var __psypicTempAssetPrismaClient:
    | PersistedAssetClient
    | null
    | undefined;
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
  const contentType = mimeTypeForFormat(input.format);
  const storageKey = getTempAssetStorageKey(filename);

  if (isLocalAssetStorage()) {
    const storageDir = getTempAssetRoot();
    const storagePath = getTempAssetPath(storageKey);

    await mkdir(/* turbopackIgnore: true */ storageDir, { recursive: true });
    await writeFile(/* turbopackIgnore: true */ storagePath, bytes);
  } else {
    const client = getObjectStorageClient();
    await client.putObject({
      key: storageKey,
      body: bytes,
      contentType
    });
  }

  const asset: TempAsset = {
    id,
    user_id: input.userId,
    task_id: input.taskId,
    mime_type: contentType,
    width: input.width,
    height: input.height,
    size_bytes: bytes.byteLength,
    temp_storage_key: storageKey,
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
    const persistedAsset = await readPersistedAssetForUser(assetId, userId);

    if (persistedAsset) {
      return persistedAsset;
    }

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
    bytes: isLocalAssetStorage()
      ? await readFile(
          /* turbopackIgnore: true */ getTempAssetPath(asset.temp_storage_key)
        )
      : await getObjectStorageClient().getObject({ key: asset.temp_storage_key })
  };
}

async function readPersistedAssetForUser(
  assetId: string,
  userId: string
): Promise<ReadableTempAsset | null> {
  const client = await getPersistedAssetClient();

  if (!client) {
    return null;
  }

  const row = await client.imageAsset.findFirst({
    where: { id: assetId, userId, deletedAt: null }
  });

  if (!row) {
    return null;
  }

  const storageKey =
    row.storageKey ?? (isLocalAssetStorage() ? inferLocalStorageKey(row) : null);

  if (!storageKey) {
    return null;
  }

  const bytes = isLocalAssetStorage()
    ? await readFile(/* turbopackIgnore: true */ getTempAssetPath(storageKey))
    : await getObjectStorageClient().getObject({ key: storageKey });
  const contentType = row.mimeType ?? mimeTypeForFormat(normalizeFormat(row.format));
  const createdAt = row.createdAt.toISOString();

  return {
    id: row.id,
    user_id: row.userId,
    task_id: row.taskId ?? "",
    mime_type: contentType,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    size_bytes: row.sizeBytes ?? bytes.byteLength,
    temp_storage_key: storageKey,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: createdAt,
    bytes
  };
}

export async function resetTempAssetStore() {
  if (!isLocalAssetStorage()) {
    const client = getObjectStorageClient();
    await Promise.all(
      Array.from(tempAssets.values()).map((asset) =>
        client.deleteObject?.({ key: asset.temp_storage_key })
      )
    );
  }

  tempAssets.clear();
  await rm(/* turbopackIgnore: true */ getTempAssetRoot(), {
    recursive: true,
    force: true
  });
}

function getTempAssetRoot() {
  const workerId = process.env.VITEST_WORKER_ID;
  const baseRoot = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "output",
    "temp-assets"
  );

  if (workerId) {
    return path.join(baseRoot, `worker-${workerId.replace(/\W/g, "_")}`);
  }

  return baseRoot;
}

function getTempAssetPath(storageKey: string) {
  return path.join(/* turbopackIgnore: true */ getTempAssetRoot(), storageKey);
}

function getTempAssetStorageKey(filename: string) {
  if (isLocalAssetStorage()) {
    return filename;
  }

  return `${normalizeStoragePrefix()}temp-assets/${filename}`;
}

function inferLocalStorageKey(row: Pick<PersistedAssetRow, "id" | "format">) {
  const format = normalizeFormat(row.format);
  return `${row.id}.${format === "jpeg" ? "jpg" : format}`;
}

function normalizeFormat(format: string): "png" | "jpeg" | "webp" {
  return format === "jpeg" || format === "webp" ? format : "png";
}

function isLocalAssetStorage() {
  const driver = process.env.ASSET_STORAGE_DRIVER?.trim().toLowerCase() || "local";

  return driver === "local";
}

function normalizeStoragePrefix() {
  const prefix = process.env.ASSET_STORAGE_PREFIX?.trim() || "";

  if (!prefix) {
    return "";
  }

  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function getObjectStorageClient() {
  if (!globalThis.__psypicObjectStorageClient) {
    globalThis.__psypicObjectStorageClient = createS3CompatibleStorageClient();
  }

  return globalThis.__psypicObjectStorageClient;
}

async function getPersistedAssetClient() {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }

  if (globalThis.__psypicTempAssetPrismaClient !== undefined) {
    return globalThis.__psypicTempAssetPrismaClient;
  }

  try {
    const prismaModule = (await import("@prisma/client")) as unknown as {
      PrismaClient?: new (options: { adapter: unknown }) => PersistedAssetClient;
    };

    globalThis.__psypicTempAssetPrismaClient = prismaModule.PrismaClient
      ? await createPostgresPrismaClient(prismaModule.PrismaClient)
      : null;
  } catch {
    globalThis.__psypicTempAssetPrismaClient = null;
  }

  return globalThis.__psypicTempAssetPrismaClient;
}

function createS3CompatibleStorageClient(): ObjectStorageClient {
  const bucket = process.env.ASSET_STORAGE_BUCKET?.trim();

  if (!bucket) {
    throw new Error("ASSET_STORAGE_BUCKET 不能为空");
  }

  const accessKeyId =
    process.env.ASSET_STORAGE_ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.ASSET_STORAGE_SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const region =
    process.env.ASSET_STORAGE_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "auto";
  const endpoint = process.env.ASSET_STORAGE_ENDPOINT?.trim() || undefined;
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: readBooleanEnv("ASSET_STORAGE_FORCE_PATH_STYLE", false),
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey
          }
        : undefined
  });

  return {
    async putObject(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: Buffer.from(input.body),
          ContentType: input.contentType
        })
      );
    },
    async getObject(input) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: input.key
        })
      );

      if (!response.Body) {
        throw new Error("对象存储返回空内容");
      }

      if ("transformToByteArray" in response.Body) {
        return response.Body.transformToByteArray();
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    },
    async deleteObject(input) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: input.key
        })
      );
    }
  };
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return fallback;
}

function mimeTypeForFormat(format: "png" | "jpeg" | "webp") {
  if (format === "jpeg") {
    return "image/jpeg";
  }

  return `image/${format}`;
}
