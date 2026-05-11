"use client";

/**
 * SyncStatusIndicator — 小型状态指示器。
 *
 * 显示状态：
 *   - synced：绿点
 *   - syncing：蓝点 + 旋转动画
 *   - offline：灰点
 *   - needs_attention：黄点 + pending 数
 *
 * 不做视觉大改，只是一个紧凑的圆点 + 文字。
 */

import * as React from "react";
import type { SyncStatus } from "@/lib/creator/sync/sync-types";

export type SyncStatusIndicatorProps = {
  status: SyncStatus;
  pendingCount: number;
  conflictCount: number;
  onRetry?: () => void;
};

const STATUS_CONFIG: Record<
  SyncStatus,
  { color: string; label: string; pulse: boolean }
> = {
  synced: { color: "#22c55e", label: "已同步", pulse: false },
  syncing: { color: "#3b82f6", label: "同步中…", pulse: true },
  offline: { color: "#9ca3af", label: "离线", pulse: false },
  needs_attention: { color: "#eab308", label: "需要关注", pulse: true }
};

export default function SyncStatusIndicator({
  status,
  pendingCount,
  conflictCount,
  onRetry
}: SyncStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className="sync-status-indicator"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "11px",
        color: "var(--text-muted, #9ca3af)",
        padding: "4px 8px",
        cursor: status === "offline" || status === "needs_attention" ? "pointer" : "default"
      }}
      onClick={
        (status === "offline" || status === "needs_attention") && onRetry
          ? onRetry
          : undefined
      }
      title={
        status === "offline"
          ? "点击重试同步"
          : status === "needs_attention"
            ? `${conflictCount} 个冲突需要处理`
            : config.label
      }
      role={status === "offline" || status === "needs_attention" ? "button" : undefined}
      data-testid="sync-status-indicator"
    >
      <span
        style={{
          display: "inline-block",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: config.color,
          animation: config.pulse ? "syncPulse 1.5s ease-in-out infinite" : "none",
          flexShrink: 0
        }}
        data-testid="sync-status-dot"
      />
      <span data-testid="sync-status-label">
        {config.label}
        {pendingCount > 0 && status !== "synced" && ` (${pendingCount})`}
      </span>
      <style>{`
        @keyframes syncPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
