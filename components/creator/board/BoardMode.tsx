"use client";

import dynamic from "next/dynamic";

import { BoardInspector } from "./BoardInspector";
import { BoardLayerList } from "./BoardLayerList";
import { BoardToolbar } from "./BoardToolbar";
import { BoardProvider } from "@/lib/creator/board/board-context";

/**
 * Board Mode · Cut 2 + Cut 3 commit 2 / 5 + Cut 3.1.1 (plan slug board-mode-final)
 *
 * 画布主壳。
 * - 画布通过 next/dynamic({ ssr: false }) 加载 BoardStage，避开
 *   Next.js SSR 时 react-konva 触发 `window/canvas is not defined`。
 * - BoardProvider 包在本组件内部（不上 CreatorWorkspace 顶层），避免
 *   全站 context 污染；CreatorWorkspace 的 board TabsContent 用
 *   forceMount，让 state 在 tab 切换时不丢。
 *
 * Cut 3.1.1 (responsive layout)：
 *   原版死写 `grid-cols-[220px_minmax(0,1fr)_280px]`，1440 viewport 下
 *   中列只剩 ~220px、390 移动端两侧栏直接撑爆。BoardMode 实际可用宽度
 *   取决于 CreatorWorkspace 左右 sidebar 折叠状态，不能直接绑 viewport
 *   breakpoint，所以这里用 `@container/board` + `@[Npx]/board:`：
 *   - 容器 < 880px：单列纵向堆叠 — canvas 排第一行（order-1），图层 /
 *     属性 排在下方。让小屏 / 窄抽屉也能拿到完整画布宽度。
 *   - 容器 ≥ 880px：3 列恢复，两侧栏收窄到 200 / 240，给中列腾空间。
 *   - canvas min-height 从死的 480px 改成 60vh，移动竖屏 / 短屏不被压。
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
        className="@container/board grid h-full w-full grid-cols-1 gap-3 @[880px]/board:grid-cols-[clamp(180px,18cqw,240px)_minmax(0,1fr)_clamp(200px,20cqw,280px)]"
      >
        {/* 容器 < 880px：order-2 把 layer-list 排到 canvas 下方（canvas order-1）。
            容器 >= 880px：grid-cols 三列把 layer-list / canvas / inspector 顺位放好。 */}
        <aside
          data-testid="board-layer-list"
          className="order-2 flex flex-col rounded-md border border-border bg-card p-3 text-sm @[880px]/board:order-1"
        >
          <header className="mb-2 font-medium text-foreground">图层</header>
          <BoardLayerList />
        </aside>
        <main className="order-1 flex h-full min-h-[60vh] flex-col gap-2 @[880px]/board:order-2 @[880px]/board:min-h-[480px]">
          <BoardToolbar />
          <BoardStageDynamic />
        </main>
        <aside
          data-testid="board-inspector"
          className="order-3 flex flex-col rounded-md border border-border bg-card p-3 text-sm @[880px]/board:order-3"
        >
          <header className="mb-2 font-medium text-foreground">属性</header>
          <BoardInspector />
        </aside>
      </div>
    </BoardProvider>
  );
}
