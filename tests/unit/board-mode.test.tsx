import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BoardLayerList } from "@/components/creator/board/BoardLayerList";
import { BoardMode } from "@/components/creator/board";
import { BoardProvider } from "@/lib/creator/board/board-context";
import type { BoardImageLayer, BoardStrokeLayer } from "@/lib/creator/board/types";

const baseTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

const imageLayer: BoardImageLayer = {
  id: "img_1",
  name: "图片 1",
  kind: "image",
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 0,
  transform: baseTransform,
  assetId: "asset_1",
  src: "blob:placeholder",
  width: 200,
  height: 200
};

const strokeLayer: BoardStrokeLayer = {
  id: "stk_1",
  name: "笔画 1",
  kind: "stroke",
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 0,
  transform: baseTransform,
  points: [10, 10, 20, 20],
  brush: { color: "#000000", size: 4, mode: "draw" }
};

/**
 * Board Mode · Cut 2 smoke + Cut 3 commit 2 layer list (plan slug board-mode-final).
 *
 * 验证 shell 真的渲染出来 —— 不是「`board-stage` 这个 div 存在」就够，
 * 还要断言背景 / 网格 / 空层 anchor 都已经挂上。
 *
 * react-konva 在 jsdom 下没有 canvas，所以 vitest.setup.ts 把 react-konva
 * 全量 mock 成 div，并把 Konva 节点的 `name` prop 转成 `data-testid`。
 */
describe("BoardMode (Cut 2 shell)", () => {
  it("renders the 3-column shell with layer-list and inspector anchors", () => {
    render(<BoardMode />);

    expect(screen.getByTestId("board-mode")).toBeInTheDocument();
    expect(screen.getByTestId("board-layer-list")).toBeInTheDocument();
    expect(screen.getByTestId("board-inspector")).toBeInTheDocument();
  });

  it("renders the canvas shell with background fill, grid, and empty layer", async () => {
    render(<BoardMode />);

    // BoardStage 通过 next/dynamic({ ssr: false }) 异步挂载
    await waitFor(
      () => {
        expect(screen.getByTestId("board-stage")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(screen.getByTestId("board-background-fill")).toBeInTheDocument();
    expect(screen.getByTestId("board-grid-group")).toBeInTheDocument();
    expect(screen.getByTestId("board-empty")).toBeInTheDocument();
  });
});

describe("BoardLayerList (Cut 3 commit 2)", () => {
  it("shows the empty state when there are no layers", () => {
    render(
      <BoardProvider>
        <BoardLayerList />
      </BoardProvider>
    );
    expect(screen.getByTestId("board-layer-list-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("board-layer-list-items")).not.toBeInTheDocument();
  });

  it("renders layers top-first and marks the active one", () => {
    render(
      <BoardProvider
        initialDocument={{
          layers: [imageLayer, strokeLayer],
          activeLayerId: "stk_1"
        }}
      >
        <BoardLayerList />
      </BoardProvider>
    );

    const items = screen.getByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>("[data-testid^='board-layer-row-']");
    expect(rows).toHaveLength(2);
    // z-index 顶层排首位：strokeLayer(后加) 在最上方
    expect(rows[0].getAttribute("data-testid")).toBe("board-layer-row-stk_1");
    expect(rows[1].getAttribute("data-testid")).toBe("board-layer-row-img_1");

    expect(rows[0]).toHaveAttribute("data-active", "true");
    expect(rows[1]).toHaveAttribute("data-active", "false");
  });

  it("selects a layer when its row button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <BoardProvider
        initialDocument={{
          layers: [imageLayer, strokeLayer],
          activeLayerId: "stk_1"
        }}
      >
        <BoardLayerList />
      </BoardProvider>
    );

    await user.click(screen.getByTestId("board-layer-select-img_1"));

    expect(screen.getByTestId("board-layer-row-img_1")).toHaveAttribute(
      "data-active",
      "true"
    );
    expect(screen.getByTestId("board-layer-row-stk_1")).toHaveAttribute(
      "data-active",
      "false"
    );
  });

  it("toggles visibility and lock via the row controls", async () => {
    const user = userEvent.setup();
    render(
      <BoardProvider
        initialDocument={{
          layers: [imageLayer],
          activeLayerId: "img_1"
        }}
      >
        <BoardLayerList />
      </BoardProvider>
    );

    const visibility = screen.getByTestId("board-layer-visibility-img_1");
    const lock = screen.getByTestId("board-layer-lock-img_1");

    expect(visibility).toHaveAttribute("aria-checked", "true");
    expect(lock).toHaveAttribute("aria-checked", "false");

    await user.click(visibility);
    expect(screen.getByTestId("board-layer-visibility-img_1")).toHaveAttribute(
      "aria-checked",
      "false"
    );

    await user.click(lock);
    expect(screen.getByTestId("board-layer-lock-img_1")).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});
