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
  created_sequence: number;
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

type PrismaImageAssetTagRow = {
  name: string;
};

type PrismaImageAssetRow = {
  id: string;
  userId: string;
  taskId: string | null;
  format: string;
  width: number | null;
  height: number | null;
  favorite: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  tags?: PrismaImageAssetTagRow[];
  task?: PrismaImageTaskRow | null;
};

type PrismaImageTaskRow = {
  id: string;
  userId: string;
  keyBindingId: string | null;
  type: ImageTaskType;
  status: ImageTaskStatus;
  prompt: string;
  params: unknown;
  usage: unknown;
  upstreamRequestId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
  assets?: PrismaImageAssetRow[];
};

type PrismaAlbumRow = {
  id: string;
  userId: string;
  title: string;
  coverAssetId: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: Array<{ assetId: string; sortOrder: number }>;
};

type PrismaImageTaskClient = {
  user?: {
    upsert(input: {
      where: { id: string };
      create: { id: string };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  imageTask: {
    create(input: { data: Record<string, unknown> }): Promise<PrismaImageTaskRow>;
    update(input: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<PrismaImageTaskRow>;
    findFirst(input: Record<string, unknown>): Promise<PrismaImageTaskRow | null>;
    findMany(input: Record<string, unknown>): Promise<PrismaImageTaskRow[]>;
  };
  imageAsset: {
    createMany(input: {
      data: Array<Record<string, unknown>>;
      skipDuplicates?: boolean;
    }): Promise<unknown>;
    findFirst(input: Record<string, unknown>): Promise<PrismaImageAssetRow | null>;
    findMany(input: Record<string, unknown>): Promise<PrismaImageAssetRow[]>;
    update(input: {
      where: { id: string };
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaImageAssetRow>;
  };
  imageAssetTag: {
    deleteMany(input: { where: { assetId: string } }): Promise<unknown>;
    createMany(input: {
      data: Array<Record<string, unknown>>;
      skipDuplicates?: boolean;
    }): Promise<unknown>;
  };
  album: {
    create(input: {
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaAlbumRow>;
    findMany(input: Record<string, unknown>): Promise<PrismaAlbumRow[]>;
  };
};

const activeTaskStatuses: ReadonlySet<ImageTaskStatus> = new Set([
  "queued",
  "running"
]);
const defaultMaxActiveImageTasksPerUser = 1;

declare global {
  var __psypicImageTasks: Map<string, ImageTask> | undefined;
  var __psypicImageTaskSequence: number | undefined;
  var __psypicImageLibraryMetadata:
    | Map<string, ImageLibraryMetadata>
    | undefined;
  var __psypicImageAlbums: Map<string, ImageAlbum> | undefined;
  var __psypicImageTaskPrismaClient:
    | PrismaImageTaskClient
    | null
    | undefined;
  var __psypicImageTaskCreationLocks: Map<string, Promise<void>> | undefined;
}

const imageTasks = globalThis.__psypicImageTasks ?? new Map<string, ImageTask>();
globalThis.__psypicImageTasks = imageTasks;
const imageLibraryMetadata =
  globalThis.__psypicImageLibraryMetadata ??
  new Map<string, ImageLibraryMetadata>();
globalThis.__psypicImageLibraryMetadata = imageLibraryMetadata;
const imageAlbums = globalThis.__psypicImageAlbums ?? new Map<string, ImageAlbum>();
globalThis.__psypicImageAlbums = imageAlbums;
const imageTaskCreationLocks =
  globalThis.__psypicImageTaskCreationLocks ?? new Map<string, Promise<void>>();
globalThis.__psypicImageTaskCreationLocks = imageTaskCreationLocks;

export function resetImageTaskStore() {
  imageTasks.clear();
  globalThis.__psypicImageTaskSequence = 0;
  imageTaskCreationLocks.clear();
}

export function resetImageLibraryStore() {
  imageLibraryMetadata.clear();
}

export function resetImageAlbumStore() {
  imageAlbums.clear();
}

export async function createImageTask(input: {
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
    created_sequence: nextImageTaskSequence(),
    updated_at: now
  };

  imageTasks.set(task.id, task);
  await createDatabaseImageTask(task);
  return task;
}

export async function markImageTaskRunning(taskId: string) {
  return updateTask(taskId, { status: "running" });
}

export async function markImageTaskSucceeded(
  taskId: string,
  input: {
    images: ImageTaskImage[];
    usage: Required<Sub2APIUsage>;
    durationMs: number;
    upstreamRequestId?: string;
  }
) {
  const task = await updateTask(taskId, {
    status: "succeeded",
    images: input.images,
    usage: input.usage,
    duration_ms: input.durationMs,
    upstream_request_id: input.upstreamRequestId
  });
  if (task) {
    await createDatabaseImageAssets(task, input.images);
  }

  return task;
}

export async function markImageTaskFailed(
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

export async function getImageTaskForUser(taskId: string, userId: string) {
  const databaseTask = await getDatabaseImageTaskForUser(taskId, userId);
  if (databaseTask) {
    return databaseTask;
  }

  const task = imageTasks.get(taskId);

  if (!task || task.user_id !== userId) {
    return null;
  }

  return task;
}

export async function cancelImageTaskForUser(taskId: string, userId: string) {
  const task = await getImageTaskForUser(taskId, userId);

  if (!task) {
    return null;
  }

  if (task.status === "queued" || task.status === "running") {
    return updateTask(task.id, { status: "canceled" });
  }

  return task;
}

export async function countActiveImageTasksForUser(userId: string) {
  const databaseCount = await countDatabaseActiveImageTasksForUser(userId);
  if (databaseCount !== null) {
    return databaseCount;
  }

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

export async function getImageTaskConcurrencyState(userId: string) {
  const active = await countActiveImageTasksForUser(userId);
  const limit = getMaxActiveImageTasksPerUser();

  return {
    active,
    limit,
    limited: active >= limit
  };
}

export async function acquireImageTaskCreationLock(userId: string) {
  const previous = imageTaskCreationLocks.get(userId);
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const tail = previous ? previous.then(() => current, () => current) : current;
  imageTaskCreationLocks.set(userId, tail);

  if (previous) {
    await previous.catch(() => undefined);
  }

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    releaseCurrent();

    if (imageTaskCreationLocks.get(userId) === tail) {
      imageTaskCreationLocks.delete(userId);
    }
  };
}

export async function listImageTaskHistoryForUser(
  userId: string,
  input?: {
    cursor?: string | null;
    limit?: number;
  }
) {
  const databaseHistory = await listDatabaseImageTaskHistoryForUser(userId, input);
  if (databaseHistory) {
    return databaseHistory;
  }

  const limit = clampHistoryLimit(input?.limit);
  const tasks = Array.from(imageTasks.values())
    .filter(
      (task) =>
        task.user_id === userId &&
        task.status === "succeeded" &&
        task.images.length > 0
    )
    .sort(compareImageTasksNewestFirst);
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

export async function serializeImageTaskHistoryItem(task: ImageTask) {
  const metadata = await getTaskCoverMetadata(task.user_id, task.images[0]?.asset_id);

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

export async function listImageLibraryAssetsForUser(
  userId: string,
  input?: {
    cursor?: string | null;
    limit?: number;
    favorite?: boolean;
    tag?: string | null;
    query?: string | null;
  }
) {
  const databaseLibrary = await listDatabaseImageLibraryAssetsForUser(
    userId,
    input
  );
  if (databaseLibrary) {
    return databaseLibrary;
  }

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
    .filter((item) => matchesLibraryQuery(item, normalizedQuery));
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

export async function updateImageLibraryAssetForUser(
  userId: string,
  assetId: string,
  patch: ImageLibraryMetadataPatch
) {
  const databaseAsset = await updateDatabaseImageLibraryAssetForUser(
    userId,
    assetId,
    patch
  );
  if (databaseAsset) {
    return databaseAsset;
  }

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

export async function getImageLibraryAssetForUser(userId: string, assetId: string) {
  const databaseAsset = await getDatabaseImageLibraryAssetForUser(userId, assetId);
  if (databaseAsset) {
    return databaseAsset;
  }

  const match = findSucceededTaskImageForUser(userId, assetId);

  if (!match) {
    return null;
  }

  return serializeImageLibraryAsset(match.task, match.image);
}

export async function createImageAlbumForUser(
  userId: string,
  input: {
    title: string;
    assetIds: string[];
  }
) {
  const title = input.title.trim();
  const assetIds = Array.from(
    new Set(input.assetIds.map((assetId) => assetId.trim()))
  );

  if (
    !title ||
    (await Promise.all(
      assetIds.map((assetId) => getImageLibraryAssetForUser(userId, assetId))
    )).some((asset) => !asset)
  ) {
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
  const databaseAlbum = await createDatabaseImageAlbum(album);

  return databaseAlbum ?? serializeImageAlbum(album);
}

export async function listImageAlbumsForUser(userId: string) {
  const databaseAlbums = await listDatabaseImageAlbumsForUser(userId);
  if (databaseAlbums) {
    return databaseAlbums;
  }

  return Array.from(imageAlbums.values())
    .filter((album) => album.user_id === userId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map(serializeImageAlbum);
}

export async function summarizeImageUsageForUser(userId: string) {
  const history = await listImageTaskHistoryForUser(userId, { limit: 50 });
  const summary = history.items.reduce(
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

async function updateTask(taskId: string, patch: Partial<ImageTask>) {
  const task = imageTasks.get(taskId);

  if (!task) {
    const databaseTask = await getDatabaseImageTaskById(taskId);
    if (!databaseTask) {
      return null;
    }
    imageTasks.set(databaseTask.id, databaseTask);
    return updateTask(taskId, patch);
  }

  const updated = {
    ...task,
    ...patch,
    updated_at: new Date().toISOString()
  };
  imageTasks.set(taskId, updated);
  await updateDatabaseImageTask(updated);

  return updated;
}

function nextImageTaskSequence() {
  const next = (globalThis.__psypicImageTaskSequence ?? 0) + 1;
  globalThis.__psypicImageTaskSequence = next;

  return next;
}

function compareImageTasksNewestFirst(left: ImageTask, right: ImageTask) {
  const createdAtOrder = right.created_at.localeCompare(left.created_at);

  if (createdAtOrder !== 0) {
    return createdAtOrder;
  }

  return right.created_sequence - left.created_sequence;
}

function listSucceededImageTasks(userId: string) {
  return Array.from(imageTasks.values())
    .filter(
      (task) =>
        task.user_id === userId &&
        task.status === "succeeded" &&
        task.images.length > 0
    )
    .sort(compareImageTasksNewestFirst);
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

async function getTaskCoverMetadata(userId: string, assetId: string | undefined) {
  if (!assetId) {
    return createEmptyImageLibraryMetadata(userId, "");
  }

  const databaseAsset = await getDatabaseImageLibraryAssetForUser(userId, assetId);
  if (databaseAsset) {
    return {
      user_id: userId,
      asset_id: assetId,
      favorite: databaseAsset.favorite,
      tags: databaseAsset.tags,
      created_at: databaseAsset.created_at,
      updated_at: databaseAsset.created_at
    };
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

function matchesLibraryQuery(
  item: ReturnType<typeof serializeImageLibraryAsset>,
  normalizedQuery: string
) {
  if (!normalizedQuery) {
    return true;
  }

  return [item.asset_id, item.task_id, item.prompt, ...item.tags]
    .join(" ")
    .toLocaleLowerCase()
    .includes(normalizedQuery);
}

async function createDatabaseImageTask(task: ImageTask) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return;
  }

  try {
    await ensureDatabaseUser(client, task.user_id);
    await client.imageTask.create({
      data: {
        id: task.id,
        userId: task.user_id,
        keyBindingId: null,
        type: task.type,
        status: task.status,
        prompt: task.prompt,
        params: task.params,
        createdAt: new Date(task.created_at),
        updatedAt: new Date(task.updated_at)
      }
    });
  } catch {
    // in-memory fallback remains the request-local source of truth
  }
}

async function updateDatabaseImageTask(task: ImageTask) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return;
  }

  try {
    await client.imageTask.update({
      where: { id: task.id },
      data: {
        status: task.status,
        prompt: task.prompt,
        params: task.params,
        usage: task.usage,
        upstreamRequestId: task.upstream_request_id,
        errorCode: task.error_code,
        errorMessage: task.error_message,
        durationMs: task.duration_ms,
        updatedAt: new Date(task.updated_at)
      }
    });
  } catch {
    // best-effort DB persistence, memory fallback stays active
  }
}

async function createDatabaseImageAssets(
  task: ImageTask,
  images: ImageTaskImage[]
) {
  const client = await getPrismaImageTaskClient();
  if (!client || images.length === 0) {
    return;
  }

  try {
    await ensureDatabaseUser(client, task.user_id);
    await client.imageAsset.createMany({
      data: images.map((image) => ({
        id: image.asset_id,
        userId: task.user_id,
        taskId: task.id,
        format: image.format,
        width: image.width,
        height: image.height,
        favorite: false,
        metadata: { url: image.url },
        createdAt: new Date(task.updated_at),
        updatedAt: new Date(task.updated_at)
      })),
      skipDuplicates: true
    });
  } catch {
    // best-effort DB persistence, memory fallback stays active
  }
}

async function getDatabaseImageTaskById(taskId: string) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return null;
  }

  try {
    const row = await client.imageTask.findFirst({
      where: { id: taskId },
      include: { assets: { include: { tags: true } } }
    });
    return row ? fromPrismaImageTask(row) : null;
  } catch {
    return null;
  }
}

async function getDatabaseImageTaskForUser(taskId: string, userId: string) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return null;
  }

  try {
    const row = await client.imageTask.findFirst({
      where: { id: taskId, userId },
      include: { assets: { include: { tags: true } } }
    });
    return row ? fromPrismaImageTask(row) : null;
  } catch {
    return null;
  }
}

async function countDatabaseActiveImageTasksForUser(userId: string) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return null;
  }

  try {
    const rows = await client.imageTask.findMany({
      where: { userId, status: { in: Array.from(activeTaskStatuses) } }
    });
    return rows.length;
  } catch {
    return null;
  }
}

async function listDatabaseImageTaskHistoryForUser(
  userId: string,
  input?: { cursor?: string | null; limit?: number }
) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return null;
  }

  try {
    const limit = clampHistoryLimit(input?.limit);
    const tasks = (
      await client.imageTask.findMany({
        where: { userId, status: "succeeded" },
        include: { assets: { include: { tags: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200
      })
    )
      .map(fromPrismaImageTask)
      .filter((task) => task.images.length > 0)
      .sort(compareImageTasksNewestFirst);
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
  } catch {
    return null;
  }
}

async function listDatabaseImageLibraryAssetsForUser(
  userId: string,
  input?: {
    cursor?: string | null;
    limit?: number;
    favorite?: boolean;
    tag?: string | null;
    query?: string | null;
  }
) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return null;
  }

  try {
    const limit = clampHistoryLimit(input?.limit);
    const normalizedTag = normalizeTag(input?.tag ?? "");
    const normalizedQuery = (input?.query ?? "").trim().toLocaleLowerCase();
    const assets = (await client.imageAsset.findMany({
      where: { userId, deletedAt: null },
      include: { task: true, tags: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200
    }))
      .map(fromPrismaImageLibraryAsset)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) =>
        input?.favorite === undefined ? true : item.favorite === input.favorite
      )
      .filter((item) => (normalizedTag ? item.tags.includes(normalizedTag) : true))
      .filter((item) => matchesLibraryQuery(item, normalizedQuery));
    const startIndex = input?.cursor
      ? assets.findIndex((item) => item.asset_id === input.cursor) + 1
      : 0;
    const safeStartIndex = Math.max(startIndex, 0);
    const page = assets.slice(safeStartIndex, safeStartIndex + limit);
    const hasNextPage = assets.length > safeStartIndex + page.length;

    return {
      items: page,
      nextCursor: hasNextPage ? page.at(-1)?.asset_id ?? null : null
    };
  } catch {
    return null;
  }
}

async function getDatabaseImageLibraryAssetForUser(
  userId: string,
  assetId: string
) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return null;
  }

  try {
    const row = await client.imageAsset.findFirst({
      where: { id: assetId, userId, deletedAt: null },
      include: { task: true, tags: true }
    });
    return row ? fromPrismaImageLibraryAsset(row) : null;
  } catch {
    return null;
  }
}

async function updateDatabaseImageLibraryAssetForUser(
  userId: string,
  assetId: string,
  patch: ImageLibraryMetadataPatch
) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return null;
  }

  try {
    const existing = await getDatabaseImageLibraryAssetForUser(userId, assetId);
    if (!existing) {
      return null;
    }

    const tags = patch.tags ? normalizeTags(patch.tags) : existing.tags;
    await client.imageAsset.update({
      where: { id: assetId },
      data: {
        favorite: patch.favorite ?? existing.favorite,
        updatedAt: new Date()
      }
    });
    if (patch.tags) {
      await client.imageAssetTag.deleteMany({ where: { assetId } });
      await client.imageAssetTag.createMany({
        data: tags.map((name) => ({
          id: createId("tag"),
          userId,
          assetId,
          name
        })),
        skipDuplicates: true
      });
    }

    return getDatabaseImageLibraryAssetForUser(userId, assetId);
  } catch {
    return null;
  }
}

async function createDatabaseImageAlbum(album: ImageAlbum) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return null;
  }

  try {
    await ensureDatabaseUser(client, album.user_id);
    const row = await client.album.create({
      data: {
        id: album.id,
        userId: album.user_id,
        title: album.title,
        coverAssetId: album.asset_ids[0] ?? null,
        createdAt: new Date(album.created_at),
        updatedAt: new Date(album.updated_at),
        items: {
          create: album.asset_ids.map((assetId, index) => ({
            id: createId("album_item"),
            assetId,
            sortOrder: index
          }))
        }
      },
      include: { items: true }
    });
    return fromPrismaAlbum(row);
  } catch {
    return null;
  }
}

async function listDatabaseImageAlbumsForUser(userId: string) {
  const client = await getPrismaImageTaskClient();
  if (!client) {
    return null;
  }

  try {
    const rows = await client.album.findMany({
      where: { userId },
      include: { items: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    return rows.map(fromPrismaAlbum);
  } catch {
    return null;
  }
}

async function ensureDatabaseUser(client: PrismaImageTaskClient, userId: string) {
  if (!client.user) {
    return;
  }

  await client.user.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {}
  });
}

async function getPrismaImageTaskClient() {
  if (!shouldUseDatabaseImageTaskStore()) {
    return null;
  }

  if (globalThis.__psypicImageTaskPrismaClient !== undefined) {
    return globalThis.__psypicImageTaskPrismaClient;
  }

  try {
    const prismaClientPackage = "@prisma/client";
    const prismaModule = (await import(
      /* turbopackIgnore: true */ prismaClientPackage
    )) as {
      PrismaClient?: new () => PrismaImageTaskClient;
    };

    globalThis.__psypicImageTaskPrismaClient = prismaModule.PrismaClient
      ? new prismaModule.PrismaClient()
      : null;
  } catch {
    globalThis.__psypicImageTaskPrismaClient = null;
  }

  return globalThis.__psypicImageTaskPrismaClient;
}

function shouldUseDatabaseImageTaskStore() {
  const mode = process.env.PSYPIC_IMAGE_TASK_STORE?.trim().toLowerCase();

  if (mode === "memory" || mode === "file") {
    return false;
  }

  return (
    mode === "database" ||
    mode === "db" ||
    (process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL))
  );
}

function fromPrismaImageTask(row: PrismaImageTaskRow): ImageTask {
  return {
    id: row.id,
    user_id: row.userId,
    key_binding_id: row.keyBindingId ?? "",
    type: row.type,
    status: row.status,
    prompt: row.prompt,
    params: isImageGenerationParams(row.params) ? row.params : imageParamsFallback(),
    images: (row.assets ?? []).map(fromPrismaImageAsset),
    usage: isUsage(row.usage) ? row.usage : undefined,
    upstream_request_id: row.upstreamRequestId ?? undefined,
    error_code: row.errorCode ?? undefined,
    error_message: row.errorMessage ?? undefined,
    duration_ms: row.durationMs ?? undefined,
    created_at: row.createdAt.toISOString(),
    created_sequence: 0,
    updated_at: row.updatedAt.toISOString()
  };
}

function fromPrismaImageAsset(row: PrismaImageAssetRow): ImageTaskImage {
  return {
    asset_id: row.id,
    url: readAssetUrl(row),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    format: row.format
  };
}

function fromPrismaImageLibraryAsset(row: PrismaImageAssetRow) {
  if (!row.task || row.task.status !== "succeeded") {
    return null;
  }

  const task = fromPrismaImageTask({ ...row.task, assets: [row] });
  const image = fromPrismaImageAsset(row);

  return {
    ...serializeImageLibraryAsset(task, image),
    favorite: row.favorite,
    tags: (row.tags ?? []).map((tag) => normalizeTag(tag.name))
  };
}

function fromPrismaAlbum(row: PrismaAlbumRow) {
  const assetIds = (row.items ?? [])
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => item.assetId);

  return {
    id: row.id,
    title: row.title,
    asset_ids: assetIds,
    asset_count: assetIds.length,
    cover_asset_id: row.coverAssetId ?? assetIds[0] ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  };
}

function readAssetUrl(row: PrismaImageAssetRow) {
  const metadata = row.metadata;

  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const url = (metadata as Record<string, unknown>).url;
    if (typeof url === "string") {
      return url;
    }
  }

  return `/api/assets/${row.id}`;
}

function isImageGenerationParams(value: unknown): value is ImageGenerationParams {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).prompt === "string"
  );
}

function imageParamsFallback(): ImageGenerationParams {
  return {
    prompt: "",
    model: "gpt-image-2",
    size: "1024x1024",
    quality: "medium",
    n: 1,
    output_format: "png",
    output_compression: null,
    background: "auto",
    moderation: "auto"
  };
}

function isUsage(value: unknown): value is Required<Sub2APIUsage> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).total_tokens === "number"
  );
}
