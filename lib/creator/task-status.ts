/**
 * 任务状态相关常量与纯判定函数。
 */

import type {
  CreatorTaskStatus,
  CurrentTask,
  ImageTaskSnapshot
} from "@/lib/creator/types";

export const taskStatusLabels: Record<CreatorTaskStatus, string> = {
  submitting: "提交中",
  queued: "排队中",
  running: "运行中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消"
};

export const taskTypeLabels: Record<NonNullable<CurrentTask["type"]>, string> = {
  generation: "文生图",
  edit: "图生图"
};

export function isImageTaskSnapshot(value: ImageTaskSnapshot): boolean {
  return Boolean(value.id && value.status && taskStatusLabels[value.status]);
}

export function canCancelTask(task: CurrentTask): boolean {
  return Boolean(
    task.id && (task.status === "queued" || task.status === "running")
  );
}

export function canRetryTask(task: CurrentTask): boolean {
  return task.status === "failed" || task.status === "canceled";
}
