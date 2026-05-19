import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardMode } from "@/components/creator/board";

/**
 * Board Mode · Cut 2 smoke (plan slug board-mode-final).
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

    // 背景 fill rect 已渲染
    expect(screen.getByTestId("board-background-fill")).toBeInTheDocument();

    // 网格线被包在 board-grid-group 内
    expect(screen.getByTestId("board-grid-group")).toBeInTheDocument();

    // 空 layer slot 存在，留给 Cut 3 接 image / stroke / text / mask
    expect(screen.getByTestId("board-empty")).toBeInTheDocument();
  });
});
