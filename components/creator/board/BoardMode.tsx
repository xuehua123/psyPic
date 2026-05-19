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
 * Cut 3.1.1 → Cut 3.1.4 (responsive layout)：
 *   原版死写 `grid-cols-[220px_minmax(0,1fr)_280px]`，1440 viewport 下
 *   中列只剩 ~220px、390 移动端两侧栏直接撑爆。BoardMode 实际可用宽度
 *   取决于 CreatorWorkspace 左右 sidebar 折叠状态，不能直接绑 viewport
 *   breakpoint，所以这里用 `@container/board` + `@[720px]/board:`：
 *   - 容器 < 720px：单列纵向堆叠 — canvas 排第一行（order-1），图层 /
 *     属性 排在下方。让小屏 / 窄抽屉也能拿到完整画布宽度。
 *   - 容器 ≥ 720px：3 列恢复，两侧栏收窄到 200 / 240，给中列腾空间。
 *   - 阈值：3.1.1 时初版用 880，3.1.4 走查发现 1920 viewport 下因外层
 *     sidebar / batch panel 吃宽度，BoardMode 容器也可能 <880 → 永远
 *     单列。降到 720 让常规桌面 viewport 可靠回到 3 列。
 *   - 移动竖屏 layer-list / inspector 不被 canvas 挤出可视区：去掉
 *     main 的 `min-h-[60vh]` 死下限，desktop 480px floor 由
 *     `@[720px]/board:min-h-[480px]` 接管；BoardStage 的 `min-h` 也
 *     从 480 降到 320，让窄容器下 canvas 不再硬占近一屏高度。
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
        className="@container/board grid h-full w-full grid-cols-1 gap-3 @[720px]/board:grid-cols-[clamp(180px,18cqw,240px)_minmax(0,1fr)_clamp(200px,20cqw,280px)]"
      >
        {/* 容器 < 720px：order-2 把 layer-list 排到 canvas 下方（canvas order-1）。
            容器 >= 720px：grid-cols 三列把 layer-list / canvas / inspector 顺位放好。 */}
        <aside
          data-testid="board-layer-list"
          className="order-2 flex flex-col rounded-md border border-border bg-card p-3 text-sm @[720px]/board:order-1"
        >
          <header className="mb-2 font-medium text-foreground">图层</header>
          <BoardLayerList />
        </aside>
        <main className="order-1 flex flex-col gap-2 @[720px]/board:order-2 @[720px]/board:min-h-[480px]">
          <BoardToolbar />
          <BoardStageDynamic />
        </main>
        <aside
          data-testid="board-inspector"
          className="order-3 flex flex-col rounded-md border border-border bg-card p-3 text-sm @[720px]/board:order-3"
        >
          <header className="mb-2 font-medium text-foreground">属性</header>
          <BoardInspector />
        </aside>
      </div>
    </BoardProvider>
  );
}
