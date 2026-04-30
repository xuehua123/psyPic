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

declare global {
  var __psypicImageTasks: Map<string, ImageTask> | undefined;
}

const imageTasks = globalThis.__psypicImageTasks ?? new Map<string, ImageTask>();
globalThis.__psypicImageTasks = imageTasks;

export function resetImageTaskStore() {
  imageTasks.clear();
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
