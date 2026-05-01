import { createId } from "@/server/services/key-binding-service";
import {
  markImageTaskFailed,
  markImageTaskRunning
} from "@/server/services/image-task-service";

export type ImageJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out";

export type ImageJob = {
  id: string;
  user_id: string;
  task_id: string;
  status: ImageJobStatus;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

declare global {
  var __psypicImageJobs: Map<string, ImageJob> | undefined;
}

const imageJobs = globalThis.__psypicImageJobs ?? new Map<string, ImageJob>();
globalThis.__psypicImageJobs = imageJobs;

export function resetImageJobQueueStore() {
  imageJobs.clear();
}

export function enqueueImageJob(input: {
  userId: string;
  taskId: string;
  maxActivePerUser?: number;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const status =
    countRunningJobsForUser(input.userId) < (input.maxActivePerUser ?? 1)
      ? "running"
      : "queued";
  const job: ImageJob = {
    id: createId("job"),
    user_id: input.userId,
    task_id: input.taskId,
    status,
    queued_at: now,
    started_at: status === "running" ? now : null,
    finished_at: null,
    updated_at: now
  };

  imageJobs.set(job.id, job);

  if (status === "running") {
    markImageTaskRunning(input.taskId);
  }

  return serializeImageJob(job);
}

export function getImageJobForTask(taskId: string) {
  const job = Array.from(imageJobs.values()).find(
    (item) => item.task_id === taskId
  );

  return job ? serializeImageJob(job) : null;
}

export function cancelImageJobForTask(taskId: string, userId: string) {
  const job = Array.from(imageJobs.values()).find(
    (item) => item.task_id === taskId && item.user_id === userId
  );

  if (!job || (job.status !== "queued" && job.status !== "running")) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: ImageJob = {
    ...job,
    status: "canceled",
    finished_at: now,
    updated_at: now
  };
  imageJobs.set(job.id, updated);

  return serializeImageJob(updated);
}

export function expireStaleImageJobs(input: {
  now: string;
  timeoutMs: number;
}) {
  const nowMs = new Date(input.now).getTime();
  const expired: ImageJob[] = [];

  for (const job of imageJobs.values()) {
    if (job.status !== "running" || !job.started_at) {
      continue;
    }

    if (nowMs - new Date(job.started_at).getTime() < input.timeoutMs) {
      continue;
    }

    const updated: ImageJob = {
      ...job,
      status: "timed_out",
      finished_at: input.now,
      updated_at: input.now
    };
    imageJobs.set(job.id, updated);
    markImageTaskFailed(job.task_id, {
      code: "timeout",
      message: "图片任务队列执行超时",
      durationMs: input.timeoutMs
    });
    expired.push(updated);
  }

  return expired.map(serializeImageJob);
}

function countRunningJobsForUser(userId: string) {
  return Array.from(imageJobs.values()).filter(
    (job) => job.user_id === userId && job.status === "running"
  ).length;
}

function serializeImageJob(job: ImageJob) {
  return {
    job_id: job.id,
    user_id: job.user_id,
    task_id: job.task_id,
    status: job.status,
    queued_at: job.queued_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    updated_at: job.updated_at
  };
}
