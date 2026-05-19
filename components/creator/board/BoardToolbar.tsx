"use client";

import { ImagePlus, MousePointer2, Pencil, Type } from "lucide-react";
import type { ComponentType } from "react";

import { useBoard, type BoardTool } from "@/lib/creator/board/board-context";
import { cn } from "@/lib/utils";

/**
 * Board Mode · Cut 3 commit 5 (plan slug board-mode-final).
 *
 * 4 个工具 chip：select / image / stroke / text。
 * - 切 chip 只 dispatch setActiveTool，不在工具栏里改 brush 参数（Cut 3
 *   commit 7 的 BoardInspector 才让用户改具体属性）。
 * - "image" chip 是状态指示，实际图片插入仍走 LibrarySection 拖放；本刀
 *   不引入「点 image chip 触发 file picker」这类副作用。
 * - eraser 不在 Cut 3 范围。
 */

type ToolOption = {
  id: BoardTool;
  label: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
};

const TOOL_OPTIONS: ToolOption[] = [
  { id: "select", label: "选择", icon: MousePointer2 },
  { id: "image", label: "图片", icon: ImagePlus },
  { id: "stroke", label: "笔画", icon: Pencil },
  { id: "text", label: "文字", icon: Type }
];

export function BoardToolbar() {
  const { state, dispatch } = useBoard();
  const activeTool = state.activeTool;

  return (
    <div
      role="toolbar"
      aria-label="画板工具"
      data-testid="board-toolbar"
      className="flex flex-row gap-1 self-start rounded-md border border-border bg-card p-1"
    >
      {TOOL_OPTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTool === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`board-tool-${id}`}
            aria-pressed={isActive}
            onClick={() => dispatch({ type: "setActiveTool", tool: id })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon size={14} aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
