"use client";

import { useCreatorStudio } from "./CreatorStudioContext";
import { useJobRuntimeEvents } from "@/lib/creator/use-job-runtime-events";
import { Activity, AlertCircle, CheckCircle2, Clock, PlayCircle, XCircle } from "lucide-react";
import type { WorkbenchJobRuntimeEventType } from "@/lib/creator/workbench-types";

function getStatusIcon(type: WorkbenchJobRuntimeEventType) {
  switch (type) {
    case "queued": return <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />;
    case "running": return <PlayCircle className="w-4 h-4 text-blue-500 animate-pulse" aria-hidden="true" />;
    case "partial_image": return <Activity className="w-4 h-4 text-orange-500" aria-hidden="true" />;
    case "succeeded": return <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden="true" />;
    case "failed": return <AlertCircle className="w-4 h-4 text-red-500" aria-hidden="true" />;
    case "canceled": return <XCircle className="w-4 h-4 text-gray-500" aria-hidden="true" />;
    case "timed_out": return <AlertCircle className="w-4 h-4 text-yellow-500" aria-hidden="true" />;
    default: return <Clock className="w-4 h-4" aria-hidden="true" />;
  }
}

function getStatusLabel(type: WorkbenchJobRuntimeEventType) {
  switch (type) {
    case "queued": return "排队中";
    case "running": return "运行中";
    case "partial_image": return "生成预览图";
    case "succeeded": return "生成成功";
    case "failed": return "生成失败";
    case "canceled": return "已取消";
    case "timed_out": return "超时";
    default: return type;
  }
}

export default function TaskDockSection({
  activeTaskId
}: {
  activeTaskId?: string | null;
}) {
  const { activeNodeId } = useCreatorStudio();

  // If there's an active task, we prefer it over activeNodeId.
  const targetTaskId = activeTaskId || null;
  const targetNodeId = activeTaskId ? null : activeNodeId;

  const { events, mode, isLoading } = useJobRuntimeEvents({
    taskId: targetTaskId,
    versionNodeId: targetNodeId
  });

  if (!targetTaskId && !targetNodeId) {
    return (
      <div className="task-dock-section border-t border-border mt-4 pt-4 text-sm text-muted-foreground" data-testid="task-dock-section">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          <span>无活动任务</span>
        </div>
      </div>
    );
  }

  return (
    <div className="task-dock-section border-t border-border mt-4 pt-4 text-sm" data-testid="task-dock-section">
      <div className="flex items-center gap-2 font-medium mb-3 text-foreground">
        <Activity className="w-4 h-4" />
        <span>任务日志 {targetTaskId ? "(当前)" : "(历史)"}</span>
      </div>

      {mode === "auth_error" ? (
        <div className="text-red-500 text-sm">请登录后查看任务日志</div>
      ) : mode === "fallback" ? (
        <div className="text-yellow-600 text-sm">无法连接服务器，暂时无法查看日志</div>
      ) : mode === "error" ? (
        <div className="text-red-500 text-sm">加载任务日志失败</div>
      ) : events.length === 0 && !isLoading ? (
        <div className="text-muted-foreground text-sm">暂无日志事件</div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-2 text-sm" data-testid={`event-item-${event.type}`}>
              <div className="mt-0.5">{getStatusIcon(event.type)}</div>
              <div className="flex-1">
                <div className="font-medium">{getStatusLabel(event.type)}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="text-muted-foreground text-xs animate-pulse">加载中...</div>
          )}
        </div>
      )}
    </div>
  );
}
