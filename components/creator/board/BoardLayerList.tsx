"use client";

import { Eye, EyeOff, Lock, Unlock } from "lucide-react";

import { useBoard } from "@/lib/creator/board/board-context";
import { cn } from "@/lib/utils";

/**
 * Board Mode · Cut 3 commit 2 (plan slug board-mode-final).
 *
 * 图层列表面板。从 BoardProvider 读 layers + activeLayerId。
 * 本刀只做：渲染 / 选中切换 / 显隐 / 锁定。
 * 拖拽排序、内联重命名、删除按钮 等 不在 Cut 3 范围。
 *
 * 列表展示顺序：z-index 顶层在最上方（与一般图像编辑器一致），
 * 因此直接 reverse 一份 layers，原数据顺序由 reducer 维护不变。
 */
export function BoardLayerList() {
  const { state, dispatch } = useBoard();
  const { layers, activeLayerId } = state.document;

  if (layers.length === 0) {
    return (
      <p
        className="text-muted-foreground"
        data-testid="board-layer-list-empty"
      >
        暂无图层
      </p>
    );
  }

  const ordered = [...layers].reverse();

  return (
    <ul
      className="flex flex-1 flex-col gap-1 overflow-y-auto"
      data-testid="board-layer-list-items"
    >
      {ordered.map((layer) => {
        const isActive = activeLayerId === layer.id;
        return (
          <li
            key={layer.id}
            data-testid={`board-layer-row-${layer.id}`}
            data-active={isActive ? "true" : "false"}
            className={cn(
              "flex items-center gap-1 rounded-sm border px-2 py-1.5",
              isActive
                ? "border-accent bg-accent-soft"
                : "border-transparent hover:bg-muted"
            )}
          >
            <button
              type="button"
              data-testid={`board-layer-select-${layer.id}`}
              onClick={() => dispatch({ type: "selectLayer", id: layer.id })}
              className="flex flex-1 items-center gap-2 text-left text-sm text-foreground"
            >
              <span className="truncate">{layer.name}</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={layer.visible}
              aria-label={`切换 ${layer.name} 可见性`}
              data-testid={`board-layer-visibility-${layer.id}`}
              onClick={() => dispatch({ type: "toggleVisible", id: layer.id })}
              className="rounded p-1 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={layer.locked}
              aria-label={`切换 ${layer.name} 锁定`}
              data-testid={`board-layer-lock-${layer.id}`}
              onClick={() => dispatch({ type: "toggleLock", id: layer.id })}
              className="rounded p-1 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
            >
              {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
