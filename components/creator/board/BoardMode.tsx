"use client";

import dynamic from "next/dynamic";
import type Konva from "konva";
import { useCallback, useRef, useState } from "react";

import { BoardExportPanel } from "./BoardExportPanel";
import type {
  BoardExportPanelExportInput,
  BoardExportPanelExportOutput
} from "./BoardExportPanel";
import { BoardInspector } from "./BoardInspector";
import { BoardLayerList } from "./BoardLayerList";
import { BoardToolbar } from "./BoardToolbar";
import { BoardProvider, useBoard } from "@/lib/creator/board/board-context";
import {
  exportBoardToPng,
  type BoardExportResult
} from "@/lib/creator/board/board-export";
import type { BoardCompositionRef } from "@/lib/creator/board/composition-ref";

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
 * Cut 3.1.1 → Cut 3.1.6 (responsive layout)：
 *   原版死写 `grid-cols-[220px_minmax(0,1fr)_280px]`，1440 viewport 下
 *   中列只剩 ~220px、390 移动端两侧栏直接撑爆。BoardMode 实际可用宽度
 *   取决于 CreatorWorkspace 左右 sidebar 折叠状态，不能直接绑 viewport
 *   breakpoint，所以这里用 `@container/board` + `@[720px]/board:`：
 *   - 容器 < 720px：单列纵向堆叠 — canvas 排第一行（order-1），图层 /
 *     属性 排在下方。让小屏 / 窄抽屉也能拿到完整画布宽度。
 *   - 容器 ≥ 720px：3 列恢复，两侧栏收窄到 200 / 240，给中列腾空间。
 *
 *   Cut 3.1.5 修了第二轮真机走查报告的两个问题：
 *   1. 1920 桌面仍单列 — 根因是 CSS container query 永远查 **祖先**
 *      容器，不查自身。3.1.1 把 `@container/board` 和 `@[720px]/board:`
 *      放在同一个 div → 永远不命中。修法是 split 成 outer container +
 *      inner grid 两层，inner 上的 `@[720px]/board:` 才能正确解析。
 *   2. 移动 stage 高度 602px 把 layer-list / inspector 顶到 composer
 *      后面 — 根因是 BoardStage 的 `h-full` 在 flex-col 链上循环解析
 *      到父容器的可用高度，绕开了 `min-h-[320px]` 下限。修法是去掉
 *      h-full，让 stage 用容器查询直接 sizing：移动 `h-[60vh]`、桌面
 *      `@[720px]/board:h-full` + 480 floor。
 *
 *   Cut 3.1.6 修了第五轮真机走查的剩余问题：
 *     mobile parent 305px，但内容总高 stage 320 + layer-list ~80 +
 *     inspector ~120 + gap ≈ 530，溢出 section 范围 → layer-list /
 *     inspector 跑到 composer 后面（y=558 / y=644，composer 从 y=484
 *     起）。outer 加 `overflow-y-auto` 让移动端在分配空间内独立滚动；
 *     桌面 `@[720px]/board:overflow-visible` 重置回非滚动 3 列布局。
 *
 *   Cut 4.3 split：BoardMode 拆成 wrapper + Inner。Inner 在 BoardProvider
 *   内部，能调 useBoard() 拿当前 BoardDocument 做 BoardCompositionRef
 *   snapshot，再通过 onUseBoardExportAsReference 抛给 CreatorWorkspace。
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

/**
 * Cut 4.2 client-side temp id：本刀不持久化导出资产，仅给 4.4 提交时
 * 走 board_export_asset_id 字段透传。Cut 5 接持久化 Asset 表后再升级
 * 为真实 asset id。
 */
function generateBoardExportAssetId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6).padStart(4, "0");
  return `board-export-${ts}-${rand}`;
}

/**
 * Cut 4.3 stable client board id：reducer document.id 默认空字符串，
 * BoardProvider 没收到 initialDocument 时一直为空。沿用 reducer
 * document.id 优先，为空时生成一份稳定 client id 留给本会话使用。Cut 5
 * 接持久化后再换成服务端 board document id。
 */
function generateClientBoardDocumentId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6).padStart(4, "0");
  return `board-doc-${ts}-${rand}`;
}

export type LastBoardExport = {
  boardExportAssetId: string;
  pixelRatio: 1 | 2;
  result: BoardExportResult;
  exportedAt: number;
};

export type BoardModeProps = {
  /**
   * Cut 4.3：用户在 BoardExportPanel 点「作为参考图编辑」并成功导出后,
   * BoardMode 会同步调一次该 callback 把 BoardCompositionRef 传给上层
   * （CreatorWorkspace），由它注入 Composer reference 并切回 transcript。
   * 不传时本组件仅在内部记录 lastExport，UI 不会自动跳出 Board。
   */
  onUseBoardExportAsReference?: (composition: BoardCompositionRef) => void;
};

/**
 * BoardMode 是「BoardProvider + 三栏布局」的薄壳。导出 / Composer 注入
 * 路径需要读 BoardProvider 内的 reducer state，所以拆出 BoardModeInner
 * 在 provider 内部消费 useBoard()。stageRef / lastExport / handleExport
 * 都搬进 inner，保持「需要 useBoard 的代码在 provider 里」这个边界。
 */
export function BoardMode({ onUseBoardExportAsReference }: BoardModeProps = {}) {
  return (
    <BoardProvider>
      <BoardModeInner onUseBoardExportAsReference={onUseBoardExportAsReference} />
    </BoardProvider>
  );
}

function BoardModeInner({ onUseBoardExportAsReference }: BoardModeProps) {
  const { state } = useBoard();

  // Cut 4.1：局部 stageRef，接 BoardStage 的 onStageReady callback。仅
  // 供 BoardExportPanel 调 stage.toDataURL 用，不放进 BoardContext —
  // BoardContext 仍是纯 reducer state。
  const stageRef = useRef<Konva.Stage | null>(null);
  const handleStageReady = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage;
  }, []);

  // Cut 4.2：把最近一次成功导出的结果保留在 BoardModeInner 本地 state，
  // 给后续真机走查 / Cut 4.4 的提交链路留落地点。
  const [lastExport, setLastExport] = useState<LastBoardExport | null>(null);

  // Cut 4.3：reducer document.id 默认 ""，session 期内只生成一次 client
  // id 复用。useRef 而非 useState 避免改 ref 触发 rerender。
  const clientBoardIdRef = useRef<string | null>(null);

  const handleExport = useCallback(
    async (
      input: BoardExportPanelExportInput
    ): Promise<BoardExportPanelExportOutput> => {
      const stage = stageRef.current;
      if (!stage) {
        return {
          ok: false,
          message: "画布尚未就绪，请稍后再试。"
        };
      }
      try {
        const result = exportBoardToPng(stage, {
          pixelRatio: input.pixelRatio
        });
        const boardExportAssetId = generateBoardExportAssetId();
        setLastExport({
          boardExportAssetId,
          pixelRatio: input.pixelRatio,
          result,
          exportedAt: Date.now()
        });

        if (onUseBoardExportAsReference) {
          // BoardDocument id 解析：优先用 reducer 内部 id，为空时复用 / 生成
          // 一份会话稳定的 client id（不发后端，仅给前端 Composer 关联用）。
          let boardDocumentId = state.document.id;
          if (!boardDocumentId) {
            if (!clientBoardIdRef.current) {
              clientBoardIdRef.current = generateClientBoardDocumentId();
            }
            boardDocumentId = clientBoardIdRef.current;
          }

          // 深拷贝 BoardDocument 快照，避免后续编辑画布时改写历史 ref。
          // structuredClone 在 Node 17+ / 现代浏览器原生支持；jsdom 也有。
          const composition: BoardCompositionRef = {
            boardDocumentId,
            boardExportAssetId,
            boardSnapshot: structuredClone(state.document),
            export: {
              blob: result.blob,
              dataUrl: result.dataUrl,
              width: result.width,
              height: result.height,
              pixelRatio: input.pixelRatio
            }
          };
          onUseBoardExportAsReference(composition);
        }

        return { ok: true, boardExportAssetId, result };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : "导出失败，请稍后再试。"
        };
      }
    },
    [onUseBoardExportAsReference, state.document]
  );

  // 当前 lastExport 仅在 BoardModeInner 内观察；Cut 4.4 起会接 generation
  // context。本刀刻意不消费它，避免 4.4 之前的代码误用。
  void lastExport;

  return (
    /* Outer：仅声明 container，不参与 grid 解析。
       移动端 (<720px) 加 overflow-y-auto：CreatorWorkspace 给 board tab
       分配的高度不够装 stage(320) + layer-list + inspector，内容会溢
       出 section 范围跑到 composer 后面。让 outer 自己内部滚动，避免
       和兄弟元素 composer 抢空间。
       桌面 (>=720px) 重置回 overflow-visible：3 列网格不需要滚动，
       也避免桌面上意外出现纵向滚动条。
       Inner：消费 @[720px]/board: 查询。CSS container query 总是查祖先,
       不查自身 —— 同一元素同时声明 + 消费会永远不命中（3.1.1 → 3.1.4
       的 1920 仍单列就是这个根因）。 */
    <div
      data-testid="board-mode"
      className="@container/board h-full w-full overflow-y-auto @[720px]/board:overflow-visible"
    >
      <div className="grid h-full w-full grid-cols-1 gap-3 @[720px]/board:grid-cols-[clamp(180px,18cqw,240px)_minmax(0,1fr)_clamp(200px,20cqw,280px)]">
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
          <BoardStageDynamic onStageReady={handleStageReady} />
        </main>
        <aside
          data-testid="board-inspector"
          className="order-3 flex flex-col gap-3 rounded-md border border-border bg-card p-3 text-sm @[720px]/board:order-3"
        >
          <header className="font-medium text-foreground">属性</header>
          <BoardInspector />
          <BoardExportPanel onExport={handleExport} />
        </aside>
      </div>
    </div>
  );
}
