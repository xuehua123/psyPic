import type { ImageGenerationParams } from "@/lib/validation/image-params";
import {
  createImageTask,
  getImageTaskForUser,
  markImageTaskFailed,
  markImageTaskRunning,
  markImageTaskSucceeded,
  type ImageTaskStatus
} from "@/server/services/image-task-service";
import {
  enqueueImageJob,
  markImageJobFailed,
  markImageJobSucceeded,
  startImageJobForTask
} from "@/server/services/image-job-queue-service";
import { recordAuditLog } from "@/server/services/audit-log-service";
import { createId, redactSensitiveValue } from "@/server/services/key-binding-service";
import {
  generateImageWithSub2API,
  Sub2APIError
} from "@/server/services/sub2api-client";
import { createTempAssetFromBase64 } from "@/server/services/temp-asset-service";

export type ImageBatchStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

type ImageBatchItem = {
  id: string;
  batch_id: string;
  task_id: string;
  prompt: string;
  params: ImageGenerationParams;
  size: ImageGenerationParams["size"];
  status: ImageTaskStatus;
  retry_count: number;
  error: { code: string; message: string } | null;
  created_at: string;
  updated_at: string;
};

type ImageBatch = {
  id: string;
  user_id: string;
  status: ImageBatchStatus;
  items: ImageBatchItem[];
  created_at: string;
  updated_at: string;
};

export type CreateImageBatchInput = {
  keyBindingId: string;
  items: Array<{
    prompt: string;
    params: ImageGenerationParams;
  }>;
};

declare global {
  var __psypicImageBatches: Map<string, ImageBatch> | undefined;
  var __psypicProcessingImageBatches: Set<string> | undefined;
}

const imageBatches =
  globalThis.__psypicImageBatches ?? new Map<string, ImageBatch>();
globalThis.__psypicImageBatches = imageBatches;
const processingImageBatches =
  globalThis.__psypicProcessingImageBatches ?? new Set<string>();
globalThis.__psypicProcessingImageBatches = processingImageBatches;

export function resetImageBatchStore() {
  imageBatches.clear();
  processingImageBatches.clear();
}

export async function createImageBatchForUser(
  userId: string,
  input: CreateImageBatchInput
) {
  const now = new Date().toISOString();
  const batchId = createId("batch");
  const items = await Promise.all(input.items.map(async (item) => {
    const task = await createImageTask({
      userId,
      keyBindingId: input.keyBindingId,
      type: "generation",
      prompt: item.prompt,
      params: item.params
    });
    enqueueImageJob({
      userId,
      taskId: task.id,
      maxActivePerUser: 0
    });

    return {
      id: createId("batch_item"),
      batch_id: batchId,
      task_id: task.id,
      prompt: item.prompt,
      params: item.params,
      size: item.params.size,
      status: "queued" as const,
      retry_count: 0,
      error: null,
      created_at: now,
      updated_at: now
    };
  }));
  const batch: ImageBatch = {
    id: batchId,
    user_id: userId,
    status: "queued",
    items,
    created_at: now,
    updated_at: now
  };

  imageBatches.set(batch.id, batch);
  return serializeImageBatch(batch);
}

export function getImageBatchForUser(batchId: string, userId: string) {
  const batch = imageBatches.get(batchId);

  if (!batch || batch.user_id !== userId) {
    return null;
  }

  return serializeImageBatch(batch);
}

export function markBatchItemFailed(
  batchId: string,
  itemId: string,
  error: { code: string; message: string }
) {
  const batch = imageBatches.get(batchId);

  if (!batch) {
    return null;
  }

  const now = new Date().toISOString();
  const items = batch.items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          status: "failed" as const,
          error: {
            code: error.code,
            message: redactSensitiveValue(error.message)
          },
          updated_at: now
        }
      : item
  );
  const updated = {
    ...batch,
    status: "failed" as const,
    items,
    updated_at: now
  };
  imageBatches.set(batch.id, updated);

  return serializeImageBatch(updated);
}

export async function retryImageBatchItemsForUser(
  batchId: string,
  userId: string,
  input: {
    keyBindingId: string;
    itemIds: string[];
  }
) {
  const batch = imageBatches.get(batchId);

  if (!batch || batch.user_id !== userId) {
    return null;
  }

  const retryIds = new Set(input.itemIds);
  const now = new Date().toISOString();
  const items = await Promise.all(batch.items.map(async (item) => {
    if (!retryIds.has(item.id) || item.status !== "failed") {
      return item;
    }

    const task = await createImageTask({
      userId,
      keyBindingId: input.keyBindingId,
      type: "generation",
      prompt: item.prompt,
      params: item.params
    });
    enqueueImageJob({
      userId,
      taskId: task.id,
      maxActivePerUser: 0
    });

    return {
      ...item,
      task_id: task.id,
      status: "queued" as const,
      retry_count: item.retry_count + 1,
      error: null,
      updated_at: now
    };
  }));
  const updated = {
    ...batch,
    status: "queued" as const,
    items,
    updated_at: now
  };
  imageBatches.set(batch.id, updated);

  return serializeImageBatch(updated);
}

export function scheduleImageBatchProcessing(
  batchId: string,
  userId: string,
  input: {
    baseUrl: string;
    apiKey: string;
    requestId?: string;
  }
) {
  const timer = setTimeout(() => {
    void processImageBatchForUser(batchId, userId, input).catch(() => undefined);
  }, 0);

  if (typeof timer === "object" && timer && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }
}

export async function processImageBatchForUser(
  batchId: string,
  userId: string,
  input: {
    baseUrl: string;
    apiKey: string;
    requestId?: string;
  }
) {
  const processingKey = `${userId}:${batchId}`;

  if (processingImageBatches.has(processingKey)) {
    return getImageBatchForUser(batchId, userId);
  }

  processingImageBatches.add(processingKey);

  try {
    let batch = imageBatches.get(batchId);

    if (!batch || batch.user_id !== userId) {
      return null;
    }

    for (const item of batch.items) {
      if (item.status !== "queued") {
        continue;
      }

      const task = await getImageTaskForUser(item.task_id, userId);

      if (!task) {
        continue;
      }

      const startedAt = Date.now();
      startImageJobForTask(item.task_id, userId);
      await markImageTaskRunning(item.task_id);
      updateBatchItem(batchId, item.id, {
        status: "running",
        error: null
      });

      try {
        const upstream = await generateImageWithSub2API({
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          params: item.params
        });
        const images = await Promise.all(
          upstream.images.map(async (image) => {
            const asset = await createTempAssetFromBase64({
              userId,
              taskId: item.task_id,
              b64Json: image.b64_json,
              format: item.params.output_format
            });

            return {
              asset_id: asset.id,
              url: `/api/assets/${asset.id}`,
              width: asset.width,
              height: asset.height,
              format: item.params.output_format
            };
          })
        );

        await markImageTaskSucceeded(item.task_id, {
          images,
          usage: upstream.usage,
          durationMs: Date.now() - startedAt,
          upstreamRequestId: upstream.upstreamRequestId
        });
        markImageJobSucceeded(item.task_id, userId);
        updateBatchItem(batchId, item.id, {
          status: "succeeded",
          error: null
        });
        await recordAuditLog({
          actorUserId: userId,
          action: "image_generation.succeeded",
          targetType: "image_task",
          targetId: item.task_id,
          requestId: input.requestId ?? createId("batch_req"),
          metadata: {
            mode: "batch",
            batch_id: batchId,
            batch_item_id: item.id,
            upstream_request_id: upstream.upstreamRequestId,
            image_count: images.length,
            usage: upstream.usage
          }
        });
      } catch (error) {
        const failure =
          error instanceof Sub2APIError
            ? {
                code: error.code,
                message: error.message,
                upstreamRequestId: error.upstreamRequestId
              }
            : {
                code: "upstream_error",
                message: "批量图片生成失败",
                upstreamRequestId: undefined
              };
        await markImageTaskFailed(item.task_id, {
          code: failure.code,
          message: failure.message,
          durationMs: Date.now() - startedAt,
          upstreamRequestId: failure.upstreamRequestId
        });
        markImageJobFailed(item.task_id, userId);
        updateBatchItem(batchId, item.id, {
          status: "failed",
          error: {
            code: failure.code,
            message: redactSensitiveValue(failure.message)
          }
        });
        await recordAuditLog({
          actorUserId: userId,
          action: "image_generation.failed",
          targetType: "image_task",
          targetId: item.task_id,
          requestId: input.requestId ?? createId("batch_req"),
          metadata: {
            mode: "batch",
            batch_id: batchId,
            batch_item_id: item.id,
            upstream_request_id: failure.upstreamRequestId,
            code: failure.code,
            message: failure.message
          }
        });
      }

      batch = imageBatches.get(batchId);
      if (!batch) {
        return null;
      }
    }

    updateBatchStatus(batchId);
    return getImageBatchForUser(batchId, userId);
  } finally {
    processingImageBatches.delete(processingKey);
  }
}

function serializeImageBatch(batch: ImageBatch) {
  return {
    batch_id: batch.id,
    status: batch.status,
    item_count: batch.items.length,
    items: batch.items.map((item) => ({
      item_id: item.id,
      task_id: item.task_id,
      prompt: item.prompt,
      params: item.params,
      size: item.size,
      status: item.status,
      retry_count: item.retry_count,
      error: item.error,
      created_at: item.created_at,
      updated_at: item.updated_at
    })),
    created_at: batch.created_at,
    updated_at: batch.updated_at
  };
}

function updateBatchItem(
  batchId: string,
  itemId: string,
  patch: Partial<Pick<ImageBatchItem, "status" | "error">>
) {
  const batch = imageBatches.get(batchId);

  if (!batch) {
    return null;
  }

  const now = new Date().toISOString();
  const items = batch.items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          ...patch,
          updated_at: now
        }
      : item
  );
  const updated = {
    ...batch,
    items,
    status: deriveBatchStatus(items),
    updated_at: now
  };
  imageBatches.set(batchId, updated);

  return updated;
}

function updateBatchStatus(batchId: string) {
  const batch = imageBatches.get(batchId);

  if (!batch) {
    return null;
  }

  const updated = {
    ...batch,
    status: deriveBatchStatus(batch.items),
    updated_at: new Date().toISOString()
  };
  imageBatches.set(batchId, updated);

  return updated;
}

function deriveBatchStatus(items: ImageBatchItem[]): ImageBatchStatus {
  if (items.length === 0) {
    return "failed";
  }

  if (items.every((item) => item.status === "succeeded")) {
    return "succeeded";
  }

  if (items.some((item) => item.status === "failed")) {
    return "failed";
  }

  if (items.some((item) => item.status === "running")) {
    return "running";
  }

  if (items.every((item) => item.status === "canceled")) {
    return "canceled";
  }

  return "queued";
}
