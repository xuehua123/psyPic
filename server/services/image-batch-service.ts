import type { ImageGenerationParams } from "@/lib/validation/image-params";
import {
  createImageTask,
  type ImageTaskStatus
} from "@/server/services/image-task-service";
import { enqueueImageJob } from "@/server/services/image-job-queue-service";
import { createId, redactSensitiveValue } from "@/server/services/key-binding-service";

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
}

const imageBatches =
  globalThis.__psypicImageBatches ?? new Map<string, ImageBatch>();
globalThis.__psypicImageBatches = imageBatches;

export function resetImageBatchStore() {
  imageBatches.clear();
}

export function createImageBatchForUser(
  userId: string,
  input: CreateImageBatchInput
) {
  const now = new Date().toISOString();
  const batchId = createId("batch");
  const items = input.items.map((item) => {
    const task = createImageTask({
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
      size: item.params.size,
      status: "queued" as const,
      retry_count: 0,
      error: null,
      created_at: now,
      updated_at: now
    };
  });
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

export function retryImageBatchItemsForUser(
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
  const items = batch.items.map((item) => {
    if (!retryIds.has(item.id) || item.status !== "failed") {
      return item;
    }

    const params = {
      prompt: item.prompt,
      model: "gpt-image-2" as const,
      size: item.size,
      quality: "medium" as const,
      n: 1,
      output_format: "png" as const,
      output_compression: null,
      background: "auto" as const,
      moderation: "auto" as const
    };
    const task = createImageTask({
      userId,
      keyBindingId: input.keyBindingId,
      type: "generation",
      prompt: item.prompt,
      params
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
  });
  const updated = {
    ...batch,
    status: "queued" as const,
    items,
    updated_at: now
  };
  imageBatches.set(batch.id, updated);

  return serializeImageBatch(updated);
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
