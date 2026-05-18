"use client";

import dynamic from "next/dynamic";

/**
 * Board Mode · Cut 2 (Phase C, plan slug board-mode-final)
 *
 * 画布主壳：3 列布局（图层列表 / 画布 / 属性面板）。
 * - 画布通过 next/dynamic({ ssr: false }) 加载 BoardStage，避开
 *   Next.js SSR 时 react-konva 触发 `window/canvas is not defined`。
 * - 左右两个 aside 是 Cut 3 的 anchor 占位，**只放 placeholder 文案**，
 *   不实现交互。
 */

const BoardStageDynamic = dynamic(
  () => import("./BoardStage").then((m) => m.BoardStage),
  {
    ssr: false,
    loading: () => (
      <div
        data-testid="board-stage-loading"
        className="flex h-full min-h-[480px] w-full items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground"
      >
        加载画布…
      </div>
    )
  }
);

export function BoardMode() {
  return (
    <div
      data-testid="board-mode"
      className="grid h-full w-full grid-cols-[220px_minmax(0,1fr)_280px] gap-3"
    >
      <aside
        data-testid="board-layer-list"
        className="flex flex-col rounded-md border border-border bg-card p-3 text-sm"
      >
        <header className="mb-2 font-medium text-foreground">图层</header>
        <p className="text-muted-foreground">暂无图层</p>
      </aside>
      <main className="flex h-full min-h-[480px] flex-col">
        <BoardStageDynamic />
      </main>
      <aside
        data-testid="board-inspector"
        className="flex flex-col rounded-md border border-border bg-card p-3 text-sm"
      >
        <header className="mb-2 font-medium text-foreground">属性</header>
        <p className="text-muted-foreground">暂无选中</p>
      </aside>
    </div>
  );
}
