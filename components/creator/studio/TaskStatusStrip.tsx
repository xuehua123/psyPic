"use client";

import { RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  canCancelTask,
  canRetryTask,
  taskStatusLabels,
  taskTypeLabels
} from "@/lib/creator/task-status";
import type { CurrentTask } from "@/lib/creator/types";

/**
 * 当前任务状态条带：在对话流底部显示生成任务的实时状态、元数据与
 * 操作按钮（刷新 / 取消 / 重新生成）。
 *
 * 来自原 CreatorWorkspace.tsx L1818-1879（4116 行单文件巨兽拆分计划
 * 的第三刀）。当前实现保留原视觉与 className，后续 Phase 5 会再统一
 * 视觉 token。
 *
 * 把 currentTask !== null 的判定收纳进组件本身（return null）让父级
 * 调用更干净。
 */
type TaskStatusStripProps = {
  currentTask: CurrentTask | null;
  isGenerating: boolean;
  onRefreshTask: (taskId: string) => void;
  onCancelTask: () => void;
  onRetryGeneration: () => void;
};

export default function TaskStatusStrip({
  currentTask,
  isGenerating,
  onRefreshTask,
  onCancelTask,
  onRetryGeneration
}: TaskStatusStripProps) {
  if (!currentTask) {
    return null;
  }

  return (
    <section
      aria-label="任务状态"
      className={`task-status-strip task-status-${currentTask.status}`}
      role="status"
    >
      <div className="task-status-main">
        <div>
          <span className="field-label">任务状态</span>
          <strong>{taskStatusLabels[currentTask.status]}</strong>
        </div>
        <span className="task-status-pill">
          {currentTask.type ? taskTypeLabels[currentTask.type] : "任务"}
        </span>
      </div>
      <div className="task-status-meta">
        <span>{currentTask.id ?? "等待任务 ID"}</span>
        {currentTask.duration_ms ? (
          <span>{currentTask.duration_ms}ms</span>
        ) : null}
        {currentTask.upstream_request_id ? (
          <span>{currentTask.upstream_request_id}</span>
        ) : null}
        {currentTask.error?.message ? (
          <span>{currentTask.error.message}</span>
        ) : null}
      </div>
      <div className="task-status-actions">
        {currentTask.id ? (
          <Button
            variant="secondary"
            onClick={() => onRefreshTask(currentTask.id ?? "")}
            type="button"
          >
            <RotateCcw size={16} aria-hidden="true" />
            刷新状态
          </Button>
        ) : null}
        {canCancelTask(currentTask) ? (
          <Button
            variant="secondary"
            onClick={onCancelTask}
            type="button"
          >
            <X size={16} aria-hidden="true" />
            取消任务
          </Button>
        ) : null}
        {canRetryTask(currentTask) ? (
          <Button
            variant="secondary"
            disabled={isGenerating}
            onClick={onRetryGeneration}
            type="button"
          >
            <RotateCcw size={16} aria-hidden="true" />
            重新生成
          </Button>
        ) : null}
      </div>
    </section>
  );
}
