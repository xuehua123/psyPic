"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useBoard } from "@/lib/creator/board/board-context";
import type { BoardExportResult } from "@/lib/creator/board/board-export";
import { cn } from "@/lib/utils";

/**
 * Board Mode · Cut 4.2 (plan slug 2026-05-20-board-mode-cut4-plan).
 *
 * Inspector 底部的导出 panel。本刀只做：
 * - 主按钮「作为参考图编辑」
 * - 1x / 2x pixelRatio 切换
 * - 空 board 禁用
 * - 点击调 BoardMode 注入的 onExport callback
 * - 显示 idle / running / success / error 4 态
 *
 * 本刀**不**做：Composer 注入（4.3）、切 transcript tab（4.3）、
 * `/api/images/edits` 提交（4.4）、持久化（Cut 5）。
 */

export type BoardExportPanelStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | {
      kind: "success";
      boardExportAssetId: string;
      width: number;
      height: number;
      pixelRatio: 1 | 2;
    }
  | { kind: "error"; message: string };

export type BoardExportPanelExportInput = {
  pixelRatio: 1 | 2;
};

export type BoardExportPanelExportOutput =
  | {
      ok: true;
      boardExportAssetId: string;
      result: BoardExportResult;
    }
  | { ok: false; message: string };

type Props = {
  /**
   * BoardMode 注入的 export callback。BoardMode 持有 stageRef 和 client
   * temp id 生成，本组件只负责 UI。
   */
  onExport?: (
    input: BoardExportPanelExportInput
  ) => Promise<BoardExportPanelExportOutput> | BoardExportPanelExportOutput;
};

export function BoardExportPanel({ onExport }: Props) {
  const { state } = useBoard();
  const layerCount = state.document.layers.length;
  const isEmpty = layerCount === 0;

  const [pixelRatio, setPixelRatio] = useState<1 | 2>(1);
  const [status, setStatus] = useState<BoardExportPanelStatus>({ kind: "idle" });

  const disabled = isEmpty || status.kind === "running" || !onExport;

  async function handleExport() {
    if (!onExport) {
      setStatus({
        kind: "error",
        message: "导出未就绪，请稍后再试。"
      });
      return;
    }
    setStatus({ kind: "running" });
    try {
      const result = await onExport({ pixelRatio });
      if (result.ok) {
        setStatus({
          kind: "success",
          boardExportAssetId: result.boardExportAssetId,
          width: result.result.width,
          height: result.result.height,
          pixelRatio
        });
      } else {
        setStatus({ kind: "error", message: result.message });
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error ? err.message : "导出失败，请稍后再试。"
      });
    }
  }

  return (
    <section
      data-testid="board-export-panel"
      className="flex flex-col gap-3 border-t border-border pt-3"
    >
      <header className="flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          导出
        </h3>
        <span
          data-testid="board-export-layer-count"
          className="text-xs text-muted-foreground"
        >
          {layerCount} 层
        </span>
      </header>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">像素比</Label>
        <div
          role="radiogroup"
          aria-label="像素比"
          data-testid="board-export-pixel-ratio"
          className="flex flex-row gap-1 rounded-md border border-border bg-card p-0.5"
        >
          {([1, 2] as const).map((value) => {
            const isActive = pixelRatio === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isActive}
                data-testid={`board-export-pixel-ratio-${value}`}
                onClick={() => setPixelRatio(value)}
                className={cn(
                  "flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {value}x
              </button>
            );
          })}
        </div>
      </div>

      <Button
        type="button"
        data-testid="board-export-as-reference"
        disabled={disabled}
        onClick={() => void handleExport()}
        className="w-full"
        size="sm"
      >
        {status.kind === "running" ? "正在导出…" : "作为参考图编辑"}
      </Button>

      {isEmpty ? (
        <p
          data-testid="board-export-empty-hint"
          className="text-xs text-muted-foreground"
        >
          画布无内容
        </p>
      ) : null}

      {status.kind === "success" ? (
        <p
          data-testid="board-export-success"
          className="text-xs text-muted-foreground"
        >
          已导出：{status.width}×{status.height}（
          <span data-testid="board-export-asset-id" className="font-mono">
            {status.boardExportAssetId}
          </span>
          ）
        </p>
      ) : null}

      {status.kind === "error" ? (
        <p
          data-testid="board-export-error"
          className="text-xs text-destructive"
        >
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
