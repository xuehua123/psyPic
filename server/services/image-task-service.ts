import type { ImageGenerationParams } from "@/lib/validation/image-params";
import { createId, redactSensitiveValue } from "@/server/services/key-binding-service";
import type { Sub2APIUsage } from "@/server/services/sub2api-client";

export type ImageTaskType = "generation" | "edit";
export type ImageTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type ImageTaskImage = {
  asset_id: string;
  url: string;
  width?: number;
  height?: number;
  format: string;
};

export type ImageTask = {
  id: string;
  user_id: string;
  key_binding_id: string;
  type: ImageTaskType;
  status: ImageTaskStatus;
  prompt: string;
  params: ImageGenerationParams;
  images: ImageTaskImage[];
  usage?: Required<Sub2APIUsage>;
  upstream_request_id?: string;
  error_code?: string;
  error_message?: string;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
};

type ImageLibraryMetadata = {
  user_id: string;
  asset_id: string;
  favorite: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ImageLibraryMetadataPatch = {
  favorite?: boolean;
  tags?: string[];
};

type ImageAlbum = {
  id: string;
  user_id: string;
  title: string;
  asset_ids: string[];
  created_at: string;
  updated_at: string;
};

const activeTaskStatuses: ReadonlySet<ImageTaskStatus> = new Set([
  "queued",
  "running"
]);
const defaultMaxActiveImageTasksPerUser = 1;

declare global {
  var __psypicImageTasks: Map<string, ImageTask> | undefined;
  var __psypicImageLibraryMetadata:
    | Map<string, ImageLibraryMetadata>
    | undefined;
  var __psypicImageAlbums: Map<string, ImageAlbum> | undefined;
}

const imageTasks = globalThis.__psypicImageTasks ?? new Map<string, ImageTask>();
globalThis.__psypicImageTasks = imageTasks;
const imageLibraryMetadata =
  globalThis.__psypicImageLibraryMetadata ??
  new Map<string, ImageLibraryMetadata>();
globalThis.__psypicImageLibraryMetadata = imageLibraryMetadata;
const imageAlbums = globalThis.__psypicImageAlbums ?? new Map<string, ImageAlbum>();
globalThis.__psypicImageAlbums = imageAlbums;

export function resetImageTaskStore() {
  imageTasks.clear();
}

export function resetImageLibraryStore() {
  imageLibraryMetadata.clear();
}

export function resetImageAlbumStore() {
  imageAlbums.clear();
}

export function createImageTask(input: {
  userId: string;
  keyBindingId: string;
  type: ImageTaskType;
  prompt: string;
  params: ImageGenerationParams;
}) {
  const now = new Date().toISOString();
  const task: ImageTask = {
    id: createId("task"),
    user_id: input.userId,
    key_binding_id: input.keyBindingId,
    type: input.type,
    status: "queued",
    prompt: input.prompt,
    params: input.params,
    images: [],
    created_at: now,
    updated_at: now
  };

  imageTasks.set(task.id, task);
  return task;
}

export function markImageTaskRunning(taskId: string) {
  return updateTask(taskId, { status: "running" });
}

export function markImageTaskSucceeded(
  taskId: string,
  input: {
    images: ImageTaskImage[];
    usage: Required<Sub2APIUsage>;
    durationMs: number;
    upstreamRequestId?: string;
  }
) {
  return updateTask(taskId, {
    status: "succeeded",
    images: input.images,
    usage: input.usage,
    duration_ms: input.durationMs,
    upstream_request_id: input.upstreamRequestId
  });
}

export function markImageTaskFailed(
  taskId: string,
  input: {
    code: string;
    message: string;
    durationMs: number;
    upstreamRequestId?: string;
  }
) {
  return updateTask(taskId, {
    status: "failed",
    error_code: input.code,
    error_message: redactSensitiveValue(input.message),
    duration_ms: input.durationMs,
    upstream_request_id: input.upstreamRequestId
  });
}

export function getImageTaskForUser(taskId: string, userId: string) {
  const task = imageTasks.get(taskId);

  if (!task || task.user_id !== userId) {
    return null;
  }

  return task;
}

export function cancelImageTaskForUser(taskId: string, userId: string) {
  const task = getImageTaskForUser(taskId, userId);

  if (!task) {
    return null;
  }

  if (task.status === "queued" || task.status === "running") {
    return updateTask(task.id, { status: "canceled" });
  }

  return task;
}

export function countActiveImageTasksForUser(userId: string) {
  return Array.from(imageTasks.values()).filter(
    (task) => task.user_id === userId && activeTaskStatuses.has(task.status)
  ).length;
}

export function getMaxActiveImageTasksPerUser() {
  const configured = Number(process.env.PSYPIC_MAX_ACTIVE_IMAGE_TASKS_PER_USER);

  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  return defaultMaxActiveImageTasksPerUser;
}

export function getImageTaskConcurrencyState(userId: string) {
  const active = countActiveImageTasksForUser(userId);
  const limit = getMaxActiveImageTasksPerUser();

  return {
    active,
    limit,
    limited: active >= limit
  };
}

export function listImageTaskHistoryForUser(
  userId: string,
  input?: {
    cursor?: string | null;
    limit?: number;
  }
) {
  const limit = clampHistoryLimit(input?.limit);
  const tasks = Array.from(imageTasks.values())
    .filter(
      (task) =>
        task.user_id === userId &&
        task.status === "succeeded" &&
        task.images.length > 0
    )
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const startIndex = input?.cursor
    ? tasks.findIndex((task) => task.id === input.cursor) + 1
    : 0;
  const safeStartIndex = Math.max(startIndex, 0);
  const page = tasks.slice(safeStartIndex, safeStartIndex + limit);
  const hasNextPage = tasks.length > safeStartIndex + page.length;

  return {
    items: page,
    nextCursor: hasNextPage ? page.at(-1)?.id ?? null : null
  };
}

export function serializeImageTaskHistoryItem(task: ImageTask) {
  const metadata = getTaskCoverMetadata(task.user_id, task.images[0]?.asset_id);

  return {
    task_id: task.id,
    type: task.type,
    prompt: task.prompt,
    params: task.params,
    thumbnail_url: task.images[0]?.url,
    images: task.images,
    usage: task.usage,
    upstream_request_id: task.upstream_request_id,
    duration_ms: task.duration_ms,
    created_at: task.created_at,
    favorite: metadata.favorite,
    tags: metadata.tags
  };
}

export function listImageLibraryAssetsForUser(
  userId: string,
  input?: {
    cursor?: string | null;
    limit?: number;
    favorite?: boolean;
    tag?: string | null;
    query?: string | null;
  }
) {
  const limit = clampHistoryLimit(input?.limit);
  const normalizedTag = normalizeTag(input?.tag ?? "");
  const normalizedQuery = (input?.query ?? "").trim().toLocaleLowerCase();
  const allItems = listSucceededImageTasks(userId)
    .flatMap((task) =>
      task.images.map((image) => serializeImageLibraryAsset(task, image))
    )
    .filter((item) =>
      input?.favorite === undefined ? true : item.favorite === input.favorite
    )
    .filter((item) => (normalizedTag ? item.tags.includes(normalizedTag) : true))
    .filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      return [item.asset_id, item.task_id, item.prompt, ...item.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  const startIndex = input?.cursor
    ? allItems.findIndex((item) => item.asset_id === input.cursor) + 1
    : 0;
  const safeStartIndex = Math.max(startIndex, 0);
  const page = allItems.slice(safeStartIndex, safeStartIndex + limit);
  const hasNextPage = allItems.length > safeStartIndex + page.length;

  return {
    items: page,
    nextCursor: hasNextPage ? page.at(-1)?.asset_id ?? null : null
  };
}

export function updateImageLibraryAssetForUser(
  userId: string,
  assetId: string,
  patch: ImageLibraryMetadataPatch
) {
  const match = findSucceededTaskImageForUser(userId, assetId);

  if (!match) {
    return null;
  }

  const existing = getImageLibraryMetadata(userId, assetId);
  const now = new Date().toISOString();
  const next: ImageLibraryMetadata = {
    user_id: userId,
    asset_id: assetId,
    favorite: patch.favorite ?? existing.favorite,
    tags: patch.tags ? normalizeTags(patch.tags) : existing.tags,
    created_at: existing.created_at || now,
    updated_at: now
  };
  imageLibraryMetadata.set(buildImageLibraryMetadataKey(userId, assetId), next);

  return serializeImageLibraryAsset(match.task, match.image);
}

export function getImageLibraryAssetForUser(userId: string, assetId: string) {
  const match = findSucceededTaskImageForUser(userId, assetId);

  if (!match) {
    return null;
  }

  return serializeImageLibraryAsset(match.task, match.image);
}

export function createImageAlbumForUser(
  userId: string,
  input: {
    title: string;
    assetIds: string[];
  }
) {
  const title = input.title.trim();
  const assetIds = Array.from(new Set(input.assetIds.map((assetId) => assetId.trim())));

  if (!title || assetIds.some((assetId) => !getImageLibraryAssetForUser(userId, assetId))) {
    return null;
  }

  const now = new Date().toISOString();
  const album: ImageAlbum = {
    id: createId("album"),
    user_id: userId,
    title,
    asset_ids: assetIds,
    created_at: now,
    updated_at: now
  };
  imageAlbums.set(album.id, album);

  return serializeImageAlbum(album);
}

export function listImageAlbumsForUser(userId: string) {
  return Array.from(imageAlbums.values())
    .filter((album) => album.user_id === userId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map(serializeImageAlbum);
}

export function summarizeImageUsageForUser(userId: string) {
  const tasks = listSucceededImageTasks(userId);
  const summary = tasks.reduce(
    (accumulator, task) => {
      accumulator.task_count += 1;
      accumulator.image_count += task.images.length;
      accumulator.input_tokens += task.usage?.input_tokens ?? 0;
      accumulator.output_tokens += task.usage?.output_tokens ?? 0;
      accumulator.total_tokens += task.usage?.total_tokens ?? 0;
      accumulator.estimatedCost += parseEstimatedCost(task.usage?.estimated_cost);
      return accumulator;
    },
    {
      task_count: 0,
      image_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimatedCost: 0
    }
  );

  return {
    task_count: summary.task_count,
    image_count: summary.image_count,
    input_tokens: summary.input_tokens,
    output_tokens: summary.output_tokens,
    total_tokens: summary.total_tokens,
    estimated_cost: summary.estimatedCost.toFixed(4)
  };
}

export function serializeImageTask(task: ImageTask) {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    prompt: task.prompt,
    params: task.params,
    images: task.images,
    usage: task.usage,
    upstream_request_id: task.upstream_request_id,
    error: task.error_code
      ? {
          code: task.error_code,
          message: task.error_message
        }
      : undefined,
    duration_ms: task.duration_ms,
    created_at: task.created_at,
    updated_at: task.updated_at
  };
}

function updateTask(taskId: string, patch: Partial<ImageTask>) {
  const task = imageTasks.get(taskId);

  if (!task) {
    return null;
  }

  const updated = {
    ...task,
    ...patch,
    updated_at: new Date().toISOString()
  };
  imageTasks.set(taskId, updated);

  return updated;
}

function listSucceededImageTasks(userId: string) {
  return Array.from(imageTasks.values())
    .filter(
      (task) =>
        task.user_id === userId &&
        task.status === "succeeded" &&
        task.images.length > 0
    )
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function clampHistoryLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    return 30;
  }

  return Math.min(Math.max(limit, 1), 50);
}

function serializeImageLibraryAsset(task: ImageTask, image: ImageTaskImage) {
  const metadata = getImageLibraryMetadata(task.user_id, image.asset_id);

  return {
    asset_id: image.asset_id,
    task_id: task.id,
    type: task.type,
    prompt: task.prompt,
    params: task.params,
    url: image.url,
    thumbnail_url: image.url,
    width: image.width,
    height: image.height,
    format: image.format,
    usage: task.usage,
    upstream_request_id: task.upstream_request_id,
    duration_ms: task.duration_ms,
    created_at: task.created_at,
    favorite: metadata.favorite,
    tags: metadata.tags
  };
}

function serializeImageAlbum(album: ImageAlbum) {
  return {
    id: album.id,
    title: album.title,
    asset_ids: album.asset_ids,
    asset_count: album.asset_ids.length,
    cover_asset_id: album.asset_ids[0] ?? null,
    created_at: album.created_at,
    updated_at: album.updated_at
  };
}

function findSucceededTaskImageForUser(userId: string, assetId: string) {
  for (const task of listSucceededImageTasks(userId)) {
    const image = task.images.find((item) => item.asset_id === assetId);

    if (image) {
      return { task, image };
    }
  }

  return null;
}

function getTaskCoverMetadata(userId: string, assetId: string | undefined) {
  if (!assetId) {
    return createEmptyImageLibraryMetadata(userId, "");
  }

  return getImageLibraryMetadata(userId, assetId);
}

function getImageLibraryMetadata(userId: string, assetId: string) {
  return (
    imageLibraryMetadata.get(buildImageLibraryMetadataKey(userId, assetId)) ??
    createEmptyImageLibraryMetadata(userId, assetId)
  );
}

function createEmptyImageLibraryMetadata(
  userId: string,
  assetId: string
): ImageLibraryMetadata {
  return {
    user_id: userId,
    asset_id: assetId,
    favorite: false,
    tags: [],
    created_at: "",
    updated_at: ""
  };
}

function buildImageLibraryMetadataKey(userId: string, assetId: string) {
  return `${userId}:${assetId}`;
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(tags.map(normalizeTag).filter((tag) => tag.length > 0))
  ).slice(0, 12);
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/\s+/g, " ").slice(0, 24);
}

function parseEstimatedCost(value: string | undefined) {
  const cost = Number(value);

  if (Number.isFinite(cost) && cost >= 0) {
    return cost;
  }

  return 0;
}
