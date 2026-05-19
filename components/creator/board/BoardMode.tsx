"use client";

import dynamic from "next/dynamic";

import { BoardInspector } from "./BoardInspector";
import { BoardLayerList } from "./BoardLayerList";
import { BoardToolbar } from "./BoardToolbar";
import { BoardProvider } from "@/lib/creator/board/board-context";

/**
 * Board Mode · Cut 2 + Cut 3 commit 2 / 5 (plan slug board-mode-final)
 *
 * 画布主壳：3 列布局（图层列表 / 画布 + toolbar / 属性面板）。
 * - 画布通过 next/dynamic({ ssr: false }) 加载 BoardStage，避开
 *   Next.js SSR 时 react-konva 触发 `window/canvas is not defined`。
 * - BoardProvider 包在本组件内部（不上 CreatorWorkspace 顶层），避免
 *   全站 context 污染；CreatorWorkspace 的 board TabsContent 用
 *   forceMount，让 state 在 tab 切换时不丢。
 * - 中列顶部挂 BoardToolbar（select / image / stroke / text 4 chip）。
 * - 右栏 inspector anchor 占位，commit 7 替换。
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
    <BoardProvider>
      <div
        data-testid="board-mode"
        className="grid h-full w-full grid-cols-[220px_minmax(0,1fr)_280px] gap-3"
      >
        <aside
          data-testid="board-layer-list"
          className="flex flex-col rounded-md border border-border bg-card p-3 text-sm"
        >
          <header className="mb-2 font-medium text-foreground">图层</header>
          <BoardLayerList />
        </aside>
        <main className="flex h-full min-h-[480px] flex-col gap-2">
          <BoardToolbar />
          <BoardStageDynamic />
        </main>
        <aside
          data-testid="board-inspector"
          className="flex flex-col rounded-md border border-border bg-card p-3 text-sm"
        >
          <header className="mb-2 font-medium text-foreground">属性</header>
          <BoardInspector />
        </aside>
      </div>
    </BoardProvider>
  );
}
