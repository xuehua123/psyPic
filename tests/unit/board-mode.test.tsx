import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoardInspector } from "@/components/creator/board/BoardInspector";
import { BoardLayerList } from "@/components/creator/board/BoardLayerList";
import { BoardMode } from "@/components/creator/board";
import * as boardExportModule from "@/lib/creator/board/board-export";
import { BoardProvider, useBoard } from "@/lib/creator/board/board-context";
import {
  libraryAssetDragPayload,
  setLibraryAssetDragData
} from "@/lib/creator/board/library-drag";
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

  it("declares container on outer wrapper and consumes the @[720px] query on a separate inner grid (Cut 3.1.5)", () => {
    // CSS container query 总是查 **祖先** 容器，永远不查自身。把
    // `@container/board` 和 `@[720px]/board:grid-cols-...` 放在同一元素
    // 上 → 永远不命中（3.1.1 → 3.1.4 的 1920 viewport 仍单列就是这个根因）。
    // 这里断言两层结构：
    // 1. outer (data-testid="board-mode") 必须带 @container/board，但不应
    //    把 @[720px]/board: grid 类带在自己身上。
    // 2. outer 的直接子元素必须带 @[720px]/board:grid-cols-... 才可能在
    //    桌面下命中 3 列。
    render(<BoardMode />);
    const outer = screen.getByTestId("board-mode");
    expect(outer.className).toMatch(/@container\/board\b/);
    expect(outer.className).not.toMatch(/@\[720px\]\/board:grid-cols-/);

    const inner = outer.firstElementChild as HTMLElement | null;
    expect(inner).not.toBeNull();
    expect(inner!.className).toMatch(/@\[720px\]\/board:grid-cols-/);
  });

  it("makes outer scrollable on mobile and resets to overflow-visible on desktop (Cut 3.1.6)", () => {
    // 移动端 BoardMode 父容器不够装 stage + layer-list + inspector，
    // 内容会溢出 section 跑到 composer 后面（第五轮真机走查的根因）。
    // outer 必须带 overflow-y-auto 让内部独立滚动；桌面用
    // @[720px]/board:overflow-visible 重置回非滚动 3 列布局。
    render(<BoardMode />);
    const outer = screen.getByTestId("board-mode");
    expect(outer.className).toMatch(/\boverflow-y-auto\b/);
    expect(outer.className).toMatch(/@\[720px\]\/board:overflow-visible/);
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

function createDataTransferStub(): DataTransfer {
  const store = new Map<string, string>();
  return {
    get types() {
      return Array.from(store.keys());
    },
    setData(type: string, value: string) {
      store.set(type, value);
    },
    getData(type: string) {
      return store.get(type) ?? "";
    },
    clearData() {
      store.clear();
    },
    effectAllowed: "uninitialized",
    dropEffect: "none"
  } as unknown as DataTransfer;
}

describe("BoardStage drop from library (Cut 3 commit 3)", () => {
  it("creates an image layer when a library asset is dropped on the canvas", async () => {
    render(<BoardMode />);

    await waitFor(
      () => {
        expect(screen.getByTestId("board-stage")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // 起步 layer list 为空
    expect(screen.getByTestId("board-layer-list-empty")).toBeInTheDocument();
    expect(document.querySelector("[data-konva-kind=\"Image\"]")).toBeNull();

    const stage = screen.getByTestId("board-stage");
    const dataTransfer = createDataTransferStub();
    setLibraryAssetDragData(
      dataTransfer,
      libraryAssetDragPayload({
        asset_id: "asset_drop_1",
        url: "https://example.com/drop.png",
        prompt: "drop test"
      })
    );

    fireEvent.dragOver(stage, { dataTransfer });
    fireEvent.drop(stage, { dataTransfer, clientX: 100, clientY: 80 });

    // 落库后 layer list empty 占位消失，多一行
    await waitFor(() => {
      expect(screen.queryByTestId("board-layer-list-empty")).not.toBeInTheDocument();
    });
    const items = screen.getByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("drop test");

    // Konva Image 节点也通过 mock 渲染出来（使用 name -> data-testid）
    const konvaImages = document.querySelectorAll(
      "[data-konva-kind=\"Image\"]"
    );
    expect(konvaImages).toHaveLength(1);
  });

  it("ignores drops that do not carry a library asset payload", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    const stage = screen.getByTestId("board-stage");
    const dataTransfer = createDataTransferStub();
    dataTransfer.setData("text/plain", "not an asset");

    fireEvent.drop(stage, { dataTransfer });

    expect(screen.getByTestId("board-layer-list-empty")).toBeInTheDocument();
    expect(document.querySelector("[data-konva-kind=\"Image\"]")).toBeNull();
  });
});

describe("BoardStage selection + transform (Cut 3 commit 4)", () => {
  async function dropAsset(assetId: string, prompt: string, clientX = 100, clientY = 80) {
    const stage = screen.getByTestId("board-stage");
    const dataTransfer = createDataTransferStub();
    setLibraryAssetDragData(
      dataTransfer,
      libraryAssetDragPayload({
        asset_id: assetId,
        url: `https://example.com/${assetId}.png`,
        prompt
      })
    );
    fireEvent.dragOver(stage, { dataTransfer });
    fireEvent.drop(stage, { dataTransfer, clientX, clientY });
  }

  function getLayerIds() {
    const items = screen.getByTestId("board-layer-list-items");
    return Array.from(
      items.querySelectorAll<HTMLElement>("[data-testid^='board-layer-row-']")
    ).map((row) => row.getAttribute("data-testid")!.replace("board-layer-row-", ""));
  }

  it("renders the Konva Transformer in the empty layer", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });
    expect(screen.getByTestId("board-transformer")).toBeInTheDocument();
  });

  it("auto-selects a layer when it is dropped onto the canvas", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    await dropAsset("asset_a", "first");
    await waitFor(() => {
      expect(screen.queryByTestId("board-layer-list-empty")).not.toBeInTheDocument();
    });
    const [firstId] = getLayerIds();
    expect(screen.getByTestId(`board-layer-row-${firstId}`)).toHaveAttribute(
      "data-active",
      "true"
    );
  });

  it("clicking a Konva image node re-selects that layer", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    await dropAsset("asset_a", "first", 100, 80);
    await dropAsset("asset_b", "second", 200, 160);

    await waitFor(() => {
      // top of list is layers[1] (z-index reversed in BoardLayerList)
      expect(getLayerIds()).toHaveLength(2);
    });
    const [topId, bottomId] = getLayerIds();
    // 第二个 drop 是新加的 → reducer activeLayerId = 第二个 layer id
    expect(screen.getByTestId(`board-layer-row-${topId}`)).toHaveAttribute(
      "data-active",
      "true"
    );

    // 点击第一层（list 底部）的 Konva mock 节点 → reducer selectLayer(bottomId)
    const firstNode = document.querySelector<HTMLElement>(
      `[data-testid="board-layer-${bottomId}"]`
    );
    expect(firstNode).not.toBeNull();
    fireEvent.click(firstNode!);

    expect(screen.getByTestId(`board-layer-row-${bottomId}`)).toHaveAttribute(
      "data-active",
      "true"
    );
    expect(screen.getByTestId(`board-layer-row-${topId}`)).toHaveAttribute(
      "data-active",
      "false"
    );
  });
});

describe("BoardStage locked layer (Cut 3 review fix)", () => {
  it("does not expose Transformer affordance for a locked active layer", async () => {
    const user = userEvent.setup();
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    // 起步：drop 一张图 → reducer 自动选中
    const stage = screen.getByTestId("board-stage");
    const dataTransfer = createDataTransferStub();
    setLibraryAssetDragData(
      dataTransfer,
      libraryAssetDragPayload({
        asset_id: "asset_locked",
        url: "https://example.com/locked.png",
        prompt: "locked test"
      })
    );
    fireEvent.dragOver(stage, { dataTransfer });
    fireEvent.drop(stage, { dataTransfer, clientX: 100, clientY: 80 });

    await waitFor(() => {
      expect(screen.queryByTestId("board-layer-list-empty")).not.toBeInTheDocument();
    });

    // 默认未锁定 → stage 暴露 data-active-layer-locked="false"
    expect(screen.getByTestId("board-stage")).toHaveAttribute(
      "data-active-layer-locked",
      "false"
    );

    // 拿到刚 drop 的 layer id
    const items = screen.getByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);
    const layerId = rows[0]
      .getAttribute("data-testid")!
      .replace("board-layer-row-", "");

    // 点 lock 按钮 → reducer toggleLock → stage 暴露 locked=true
    await user.click(screen.getByTestId(`board-layer-lock-${layerId}`));
    expect(screen.getByTestId(`board-layer-lock-${layerId}`)).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("board-stage")).toHaveAttribute(
      "data-active-layer-locked",
      "true"
    );

    // 再 toggle 回去
    await user.click(screen.getByTestId(`board-layer-lock-${layerId}`));
    expect(screen.getByTestId("board-stage")).toHaveAttribute(
      "data-active-layer-locked",
      "false"
    );
  });
});

describe("BoardStage invisible layer (Cut 3.1.3)", () => {
  it("does not expose Transformer affordance for an invisible active layer", async () => {
    const user = userEvent.setup();
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    // 起步：drop 一张图 → reducer 自动选中
    const stage = screen.getByTestId("board-stage");
    const dataTransfer = createDataTransferStub();
    setLibraryAssetDragData(
      dataTransfer,
      libraryAssetDragPayload({
        asset_id: "asset_invisible",
        url: "https://example.com/invisible.png",
        prompt: "invisible test"
      })
    );
    fireEvent.dragOver(stage, { dataTransfer });
    fireEvent.drop(stage, { dataTransfer, clientX: 100, clientY: 80 });

    await waitFor(() => {
      expect(screen.queryByTestId("board-layer-list-empty")).not.toBeInTheDocument();
    });

    // 默认可见 → stage 暴露 data-active-layer-visible="true"
    expect(screen.getByTestId("board-stage")).toHaveAttribute(
      "data-active-layer-visible",
      "true"
    );

    const items = screen.getByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);
    const layerId = rows[0]
      .getAttribute("data-testid")!
      .replace("board-layer-row-", "");

    // 点 visibility 按钮 → reducer toggleVisible → stage 暴露 visible=false
    await user.click(screen.getByTestId(`board-layer-visibility-${layerId}`));
    expect(
      screen.getByTestId(`board-layer-visibility-${layerId}`)
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("board-stage")).toHaveAttribute(
      "data-active-layer-visible",
      "false"
    );

    // 再 toggle 回去
    await user.click(screen.getByTestId(`board-layer-visibility-${layerId}`));
    expect(screen.getByTestId("board-stage")).toHaveAttribute(
      "data-active-layer-visible",
      "true"
    );
  });
});

describe("BoardStage konva drag/transform handlers (Cut 3.1.5 commit 2)", () => {
  // 排查思路：3.1.4 commit 2 view-sync 已验证「外部 dispatch transformLayer
  // → Inspector input 跟随刷新」。但用户第三轮真机走查报告「真实画布拖
  // text 后 Inspector x/y 仍不变」—— 说明拖动路径里 reducer 根本没收到
  // dispatch。本测试组直接调 layer node 上 React-attached 的 onDragEnd /
  // onTransformEnd handler（绕过 Konva 真实事件循环），传 Konva-shape-stub
  // 的 target，断言 reducer 收到 transformLayer 且 Inspector 视图跟刷。
  //
  // 如果 PASS → BoardStage 的 handler 链路在测试环境是好的，真机失败的
  // 根因不在 handler 链路本身（要换方向排查，比如 Konva node 是否
  // draggable、Transformer 是否拦截事件等）。
  // 如果 FAIL → handler 链路自身坏，本刀直接修。

  function getReactHandler(
    node: HTMLElement,
    prop: string
  ): (e: { target?: unknown }) => void {
    const propsKey = Object.keys(node).find((k) =>
      k.startsWith("__reactProps$")
    );
    if (!propsKey) {
      throw new Error("React 19 props key not found on layer node");
    }
    const props = (node as unknown as Record<string, Record<string, unknown>>)[
      propsKey
    ];
    const handler = props[prop];
    if (typeof handler !== "function") {
      throw new Error(`${prop} not bound on layer node`);
    }
    return handler as (e: { target?: unknown }) => void;
  }

  function konvaShapeStub(values: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
  }) {
    return {
      // snapshotFromKonvaTarget 调 .x() / .y() / .scaleX() / .scaleY() / .rotation() —
      // 全部 getter 风格。bakeScaleOnKonvaTarget 调 .scaleX(1) / .scaleY(1) —
      // 同名函数允许带参，stub 忽略参数即可。
      x: () => values.x,
      y: () => values.y,
      scaleX: (_v?: number) => values.scaleX,
      scaleY: (_v?: number) => values.scaleY,
      rotation: () => values.rotation
    };
  }

  async function dropImage(
    assetId: string,
    prompt: string,
    clientX = 50,
    clientY = 50
  ) {
    const stage = screen.getByTestId("board-stage");
    const dataTransfer = createDataTransferStub();
    setLibraryAssetDragData(
      dataTransfer,
      libraryAssetDragPayload({
        asset_id: assetId,
        url: `https://example.com/${assetId}.png`,
        prompt
      })
    );
    fireEvent.dragOver(stage, { dataTransfer });
    fireEvent.drop(stage, { dataTransfer, clientX, clientY });
    await waitFor(() => {
      expect(
        document.querySelector("[data-konva-kind=\"Image\"]")
      ).not.toBeNull();
    });
    const items = screen.getByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    return rows[0].getAttribute("data-testid")!.replace("board-layer-row-", "");
  }

  it("onDragEnd on a layer node dispatches transformLayer with new x/y", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    const layerId = await dropImage("drag_test", "drag test");
    const layerNode = document.querySelector<HTMLElement>(
      `[data-testid="board-layer-${layerId}"]`
    );
    expect(layerNode).not.toBeNull();

    // Inspector 起步 x/y 不应是 999/888
    expect(screen.getByTestId("board-inspector-x")).not.toHaveValue(999);
    expect(screen.getByTestId("board-inspector-y")).not.toHaveValue(888);

    // 直调 React-attached onDragEnd，传 Konva-shape-stub 的 target。
    // act() 包一下，让 reducer dispatch 触发的 setState 在断言前 flush。
    const onDragEnd = getReactHandler(layerNode!, "onDragEnd");
    act(() => {
      onDragEnd({
        target: konvaShapeStub({
          x: 999,
          y: 888,
          scaleX: 1,
          scaleY: 1,
          rotation: 0
        })
      });
    });

    // 通过 3.1.4 view-sync 通路，Inspector 输入应跟随刷新到新值
    expect(screen.getByTestId("board-inspector-x")).toHaveValue(999);
    expect(screen.getByTestId("board-inspector-y")).toHaveValue(888);
  });

  it("onTransformEnd on an image layer bakes scale into width/height and resets transform.scale", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    const layerId = await dropImage("xform_test", "xform test");
    const layerNode = document.querySelector<HTMLElement>(
      `[data-testid="board-layer-${layerId}"]`
    );
    expect(layerNode).not.toBeNull();

    // 起步 image width/height = 320（drop 默认 size）
    expect(screen.getByTestId("board-inspector-image-width")).toHaveValue(320);
    expect(screen.getByTestId("board-inspector-image-height")).toHaveValue(320);

    // Konva transformerEnd：scaleX=1.5 / scaleY=2 → 烘进 width=480 / height=640
    const onTransformEnd = getReactHandler(layerNode!, "onTransformEnd");
    act(() => {
      onTransformEnd({
        target: konvaShapeStub({
          x: 50,
          y: 60,
          scaleX: 1.5,
          scaleY: 2,
          rotation: 30
        })
      });
    });

    expect(screen.getByTestId("board-inspector-image-width")).toHaveValue(480);
    expect(screen.getByTestId("board-inspector-image-height")).toHaveValue(640);
    // scale 烘完应回到 1，rotation 保留
    expect(screen.getByTestId("board-inspector-scaleX")).toHaveValue(1);
    expect(screen.getByTestId("board-inspector-scaleY")).toHaveValue(1);
    expect(screen.getByTestId("board-inspector-rotation")).toHaveValue(30);
  });
});

describe("BoardStage onStageReady (Cut 4.1)", () => {
  it("forwards a non-null stage handle on mount and clears it on unmount", async () => {
    // BoardStage 在 BoardMode 里通过 next/dynamic 异步加载；这里直接拿
    // 内部 BoardStage 在 BoardProvider 下挂载，绕过 dynamic loader，可
    // 同步断言 onStageReady 调用。
    const { BoardStage } = await import(
      "@/components/creator/board/BoardStage"
    );
    const onStageReady = vi.fn();
    const { unmount } = render(
      <BoardProvider>
        <BoardStage onStageReady={onStageReady} />
      </BoardProvider>
    );

    // mount effect 至少触发一次
    expect(onStageReady).toHaveBeenCalled();
    // 至少其中一次拿到非 null（react-konva mock 把 ref 透传到 div）
    const argsBeforeUnmount = onStageReady.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(argsBeforeUnmount.some((arg: unknown) => arg !== null)).toBe(true);

    onStageReady.mockClear();
    unmount();
    // unmount 时调一次 null 让 BoardMode 清掉 ref
    expect(onStageReady).toHaveBeenCalledWith(null);
  });
});

describe("BoardExportPanel (Cut 4.2)", () => {
  it("disables the export button on an empty board and shows the empty hint", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });
    const button = screen.getByTestId("board-export-as-reference");
    expect(button).toBeDisabled();
    expect(screen.getByTestId("board-export-empty-hint")).toBeInTheDocument();
  });

  it("enables the export button after dropping an image layer", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    const stage = screen.getByTestId("board-stage");
    const dataTransfer = createDataTransferStub();
    setLibraryAssetDragData(
      dataTransfer,
      libraryAssetDragPayload({
        asset_id: "asset_export_enable",
        url: "https://example.com/enable.png",
        prompt: "enable"
      })
    );
    fireEvent.dragOver(stage, { dataTransfer });
    fireEvent.drop(stage, { dataTransfer, clientX: 80, clientY: 80 });

    await waitFor(() => {
      expect(screen.getByTestId("board-export-as-reference")).not.toBeDisabled();
    });
    expect(screen.queryByTestId("board-export-empty-hint")).not.toBeInTheDocument();
  });

  it("calls exportBoardToPng with the chosen pixel ratio and renders success state with a temp asset id", async () => {
    const user = userEvent.setup();
    const exportSpy = vi
      .spyOn(boardExportModule, "exportBoardToPng")
      .mockReturnValue({
        dataUrl: "data:image/png;base64,AAEC",
        blob: new Blob([new Uint8Array([0, 1, 2])], { type: "image/png" }),
        width: 1280,
        height: 960
      });

    try {
      render(<BoardMode />);
      await waitFor(() => {
        expect(screen.getByTestId("board-stage")).toBeInTheDocument();
      });

      // drop 一张图让按钮 enable
      const stage = screen.getByTestId("board-stage");
      const dataTransfer = createDataTransferStub();
      setLibraryAssetDragData(
        dataTransfer,
        libraryAssetDragPayload({
          asset_id: "asset_export_run",
          url: "https://example.com/run.png",
          prompt: "run"
        })
      );
      fireEvent.dragOver(stage, { dataTransfer });
      fireEvent.drop(stage, { dataTransfer, clientX: 80, clientY: 80 });
      await waitFor(() => {
        expect(screen.getByTestId("board-export-as-reference")).not.toBeDisabled();
      });

      // 切到 2x
      await user.click(screen.getByTestId("board-export-pixel-ratio-2"));
      expect(screen.getByTestId("board-export-pixel-ratio-2")).toHaveAttribute(
        "aria-checked",
        "true"
      );

      // 点击导出
      await user.click(screen.getByTestId("board-export-as-reference"));

      await waitFor(() => {
        expect(screen.getByTestId("board-export-success")).toBeInTheDocument();
      });

      expect(exportSpy).toHaveBeenCalledTimes(1);
      const callArgs = exportSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({ pixelRatio: 2 });

      const tempId = screen.getByTestId("board-export-asset-id").textContent ?? "";
      expect(tempId).toMatch(/^board-export-\d+-[a-z0-9]{4}$/);
    } finally {
      exportSpy.mockRestore();
    }
  });

  it("shows the helper exception message when exportBoardToPng throws (e.g. tainted canvas)", async () => {
    const user = userEvent.setup();
    const exportSpy = vi
      .spyOn(boardExportModule, "exportBoardToPng")
      .mockImplementation(() => {
        throw new Error("tainted canvas");
      });

    try {
      render(<BoardMode />);
      await waitFor(() => {
        expect(screen.getByTestId("board-stage")).toBeInTheDocument();
      });

      const stage = screen.getByTestId("board-stage");
      const dataTransfer = createDataTransferStub();
      setLibraryAssetDragData(
        dataTransfer,
        libraryAssetDragPayload({
          asset_id: "asset_export_err",
          url: "https://example.com/err.png",
          prompt: "err"
        })
      );
      fireEvent.dragOver(stage, { dataTransfer });
      fireEvent.drop(stage, { dataTransfer, clientX: 80, clientY: 80 });
      await waitFor(() => {
        expect(screen.getByTestId("board-export-as-reference")).not.toBeDisabled();
      });

      await user.click(screen.getByTestId("board-export-as-reference"));

      const errorNode = await screen.findByTestId("board-export-error");
      expect(errorNode).toHaveTextContent("tainted canvas");
      expect(screen.queryByTestId("board-export-success")).not.toBeInTheDocument();
    } finally {
      exportSpy.mockRestore();
    }
  });

  it("renders an error returned by the onExport callback without crashing (e.g. stage ref missing)", async () => {
    // BoardMode.handleExport 在 stageRef.current === null 时会返回
    // { ok: false, message: "画布尚未就绪…" }。这里直接以 onExport=
    // () => ({ ok: false, message }) mock 那种集成态，验证 panel 把
    // 错误消息渲染到 board-export-error，且不抛异常崩 React tree。
    const user = userEvent.setup();
    const { BoardExportPanel } = await import(
      "@/components/creator/board/BoardExportPanel"
    );
    render(
      <BoardProvider
        initialDocument={{ layers: [imageLayer], activeLayerId: "img_1" }}
      >
        <BoardExportPanel
          onExport={() => ({
            ok: false,
            message: "画布尚未就绪，请稍后再试。"
          })}
        />
      </BoardProvider>
    );

    await user.click(screen.getByTestId("board-export-as-reference"));
    expect(screen.getByTestId("board-export-error")).toHaveTextContent(
      /未就绪/
    );
    // panel 仍在树里 —— 没崩
    expect(screen.getByTestId("board-export-panel")).toBeInTheDocument();
  });
});

describe("BoardToolbar (Cut 3 commit 5)", () => {
  it("renders 4 tool chips with select active by default", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-toolbar")).toBeInTheDocument();
    });
    expect(screen.getByTestId("board-tool-select")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    for (const id of ["image", "stroke", "text"]) {
      expect(screen.getByTestId(`board-tool-${id}`)).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    }
  });

  it("dispatches setActiveTool when a chip is clicked", async () => {
    const user = userEvent.setup();
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-toolbar")).toBeInTheDocument();
    });
    const stage = screen.getByTestId("board-stage");
    expect(stage).toHaveAttribute("data-active-tool", "select");

    await user.click(screen.getByTestId("board-tool-stroke"));
    expect(screen.getByTestId("board-tool-stroke")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("board-stage")).toHaveAttribute(
      "data-active-tool",
      "stroke"
    );
  });
});

describe("BoardStage stroke tool (Cut 3 commit 5)", () => {
  it("creates a stroke layer on mousedown and appends points on move", async () => {
    const user = userEvent.setup();
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    // 先切到 stroke 工具
    await user.click(screen.getByTestId("board-tool-stroke"));
    expect(screen.getByTestId("board-stage")).toHaveAttribute(
      "data-active-tool",
      "stroke"
    );

    const stage = screen.getByTestId("board-stage");

    // jsdom 中 getBoundingClientRect 默认返回零矩形 → 落在 (0,0)
    fireEvent.mouseDown(stage, { clientX: 50, clientY: 60 });

    // mousedown 后 layers length=1，且当前 active = stroke layer
    const items = await screen.findByTestId("board-layer-list-items");
    let rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);
    const strokeId = rows[0]
      .getAttribute("data-testid")!
      .replace("board-layer-row-", "");

    const lineNode = () =>
      document.querySelector<HTMLElement>(
        `[data-testid="board-layer-${strokeId}"]`
      );
    expect(lineNode()).not.toBeNull();

    // 拿到起步 points string
    const initialPoints = lineNode()!.getAttribute("data-konva-points");
    expect(initialPoints).toBe("50,60");

    // 拖动 mouse 几次 → updateStrokeLayer 不停 patch points
    fireEvent.mouseMove(stage, { clientX: 70, clientY: 80 });
    fireEvent.mouseMove(stage, { clientX: 90, clientY: 100 });

    const afterMovePoints = lineNode()!.getAttribute("data-konva-points");
    expect(afterMovePoints).toBe("50,60,70,80,90,100");

    // mouseup 之后 layer count 不再增长
    fireEvent.mouseUp(stage);
    rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);

    // 抬起后再 move 不应该再 append（drawing=null）
    fireEvent.mouseMove(stage, { clientX: 999, clientY: 999 });
    expect(lineNode()!.getAttribute("data-konva-points")).toBe(
      "50,60,70,80,90,100"
    );
  });

  it("does not draw when active tool is select", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    const stage = screen.getByTestId("board-stage");
    fireEvent.mouseDown(stage, { clientX: 50, clientY: 60 });
    fireEvent.mouseMove(stage, { clientX: 70, clientY: 80 });
    fireEvent.mouseUp(stage);

    expect(screen.getByTestId("board-layer-list-empty")).toBeInTheDocument();
  });
});

describe("BoardStage text tool (Cut 3 commit 6 + Cut 3.1.2 hit-testing)", () => {
  function getStageNode(): HTMLElement {
    const stage = document.querySelector<HTMLElement>(
      "[data-konva-kind=\"Stage\"]"
    );
    if (!stage) throw new Error("stage konva mock node not mounted");
    return stage;
  }

  it("creates a text layer when clicking empty space in text mode", async () => {
    const user = userEvent.setup();
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("board-tool-text"));
    expect(screen.getByTestId("board-stage")).toHaveAttribute(
      "data-active-tool",
      "text"
    );

    // 点击 Stage 自身（空白）→ 落 text layer。命中检测走
    // target.dataset.testid 是否以 "board-layer-" 开头；Stage 节点没这个，
    // 视为空白。
    fireEvent.click(getStageNode(), { clientX: 100, clientY: 80 });

    const items = await screen.findByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("文字图层");

    const textNode = document.querySelector<HTMLElement>(
      "[data-konva-kind=\"Text\"]"
    );
    expect(textNode).not.toBeNull();
  });

  it("does not stack text layers when clicking on an existing layer node", async () => {
    const user = userEvent.setup();
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("board-tool-text"));

    // 第一次：点 stage 空白处 → 创建第一个 text layer
    fireEvent.click(getStageNode(), { clientX: 100, clientY: 80 });

    const firstNode = await waitFor(() => {
      const node = document.querySelector<HTMLElement>(
        "[data-konva-kind=\"Text\"]"
      );
      expect(node).not.toBeNull();
      return node!;
    });

    // 第二次：点已有 text layer 节点本体 → 命中 board-layer- 前缀，
    // onUserLayer=true → 不创建新层（事件冒泡到 Stage 也被命中检测拦下）。
    fireEvent.click(firstNode, { clientX: 105, clientY: 85 });

    const items = screen.getByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);
  });

  it("does not create text layers in select mode (background click only deselects)", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    // select 模式下点 stage 空白 → 不应创建任何 text layer
    fireEvent.click(getStageNode(), { clientX: 100, clientY: 80 });

    expect(screen.getByTestId("board-layer-list-empty")).toBeInTheDocument();
  });

  it("does not create text layers when clicking the Konva background fill in text mode", async () => {
    // 命中检测必须把 background-fill 视作空白：旧版 `target.getStage() === target`
    // 会把 Rect 误判成「非空」，新版用 name 前缀，背景 name="board-background-fill"
    // 不以 "board-layer-" 开头 → onEmpty=true → 创建 text。
    const user = userEvent.setup();
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("board-tool-text"));

    const bg = screen.getByTestId("board-background-fill");
    fireEvent.click(bg, { clientX: 60, clientY: 60 });

    const items = await screen.findByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("文字图层");
  });
});

describe("BoardInspector (Cut 3 commit 7)", () => {
  function LayerSpy({ id }: { id: string }) {
    const { state } = useBoard();
    const layer = state.document.layers.find((l) => l.id === id);
    if (!layer) return <div data-testid={`spy-${id}-missing`} />;
    return (
      <div>
        <span data-testid={`spy-${id}-name`}>{layer.name}</span>
        <span data-testid={`spy-${id}-opacity`}>{layer.opacity}</span>
        {layer.kind === "text" ? (
          <span data-testid={`spy-${id}-text`}>{layer.text}</span>
        ) : null}
        {layer.kind === "stroke" ? (
          <span data-testid={`spy-${id}-stroke-color`}>{layer.brush.color}</span>
        ) : null}
      </div>
    );
  }

  it("shows the empty state when no layer is selected", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });
    expect(screen.getByTestId("board-inspector-empty")).toBeInTheDocument();
  });

  it("dispatches updateLayer on name blur (not on every keystroke)", async () => {
    const user = userEvent.setup();
    render(
      <BoardProvider
        initialDocument={{
          layers: [imageLayer],
          activeLayerId: "img_1"
        }}
      >
        <BoardInspector />
        <LayerSpy id="img_1" />
      </BoardProvider>
    );

    // 初始 spy reads layer.name from reducer state
    expect(screen.getByTestId("spy-img_1-name")).toHaveTextContent(imageLayer.name);

    const name = screen.getByTestId("board-inspector-name") as HTMLInputElement;
    await user.clear(name);
    await user.type(name, "重命名");
    // 在 blur 之前 reducer 还没收到 dispatch，spy 仍是旧值
    expect(screen.getByTestId("spy-img_1-name")).toHaveTextContent(imageLayer.name);

    await user.tab();
    // blur 之后 dispatch 已完成，spy 反映新值
    expect(screen.getByTestId("spy-img_1-name")).toHaveTextContent("重命名");
  });

  it("clamps opacity into [0,1] on blur via reducer (verified through spy)", async () => {
    const user = userEvent.setup();
    render(
      <BoardProvider
        initialDocument={{
          layers: [imageLayer],
          activeLayerId: "img_1"
        }}
      >
        <BoardInspector />
        <LayerSpy id="img_1" />
      </BoardProvider>
    );

    expect(screen.getByTestId("spy-img_1-opacity")).toHaveTextContent("1");

    const opacity = screen.getByTestId("board-inspector-opacity") as HTMLInputElement;
    await user.clear(opacity);
    await user.type(opacity, "5");
    await user.tab();

    // reducer state should hold the clamped value (1)
    expect(screen.getByTestId("spy-img_1-opacity")).toHaveTextContent("1");
  });

  it("renders the image section when the active layer is an image", () => {
    render(
      <BoardProvider
        initialDocument={{ layers: [imageLayer], activeLayerId: "img_1" }}
      >
        <BoardInspector />
      </BoardProvider>
    );
    expect(screen.getByTestId("board-inspector-image-width")).toBeInTheDocument();
    expect(screen.getByTestId("board-inspector-image-height")).toBeInTheDocument();
    expect(screen.queryByTestId("board-inspector-stroke-color")).not.toBeInTheDocument();
    expect(screen.queryByTestId("board-inspector-text-content")).not.toBeInTheDocument();
  });

  it("renders the stroke section when the active layer is a stroke", () => {
    render(
      <BoardProvider
        initialDocument={{ layers: [strokeLayer], activeLayerId: "stk_1" }}
      >
        <BoardInspector />
      </BoardProvider>
    );
    expect(screen.getByTestId("board-inspector-stroke-color")).toBeInTheDocument();
    expect(screen.getByTestId("board-inspector-stroke-size")).toBeInTheDocument();
    expect(screen.queryByTestId("board-inspector-image-width")).not.toBeInTheDocument();
    // Cut 3 不暴露 brush.mode（draw/erase）切换 —— 没有 eraser/mask UI
    expect(screen.queryByText(/erase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/橡皮/)).not.toBeInTheDocument();
  });

  it("text section dispatches updateTextLayer on textarea blur (verified through spy)", async () => {
    const user = userEvent.setup();
    const textLayer = {
      id: "txt_1",
      name: "Text",
      kind: "text" as const,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 0,
      transform: baseTransform,
      text: "hello",
      fontSize: 18,
      fontFamily: "system-ui",
      fill: "#000000"
    };
    render(
      <BoardProvider
        initialDocument={{ layers: [textLayer], activeLayerId: "txt_1" }}
      >
        <BoardInspector />
        <LayerSpy id="txt_1" />
      </BoardProvider>
    );

    expect(screen.getByTestId("spy-txt_1-text")).toHaveTextContent("hello");

    const content = screen.getByTestId(
      "board-inspector-text-content"
    ) as HTMLTextAreaElement;
    expect(content).toHaveValue("hello");
    await user.clear(content);
    await user.type(content, "你好");
    await user.tab();

    expect(screen.getByTestId("spy-txt_1-text")).toHaveTextContent("你好");
  });
});

describe("BoardInspector (Cut 3.1.4 view sync after external dispatch)", () => {
  // 模拟 canvas drag / transformerEnd 路径：BoardStage 的 onDragEnd /
  // onTransformEnd 会 dispatch transformLayer，把 reducer 里的 transform
  // 更新。Inspector 的 transform input 是 uncontrolled defaultValue —
  // 必须能跟着外部 dispatch 同步刷新，否则用户拖完图回头看 Inspector，
  // x / y 仍是老值（第二轮真机走查里报的现象）。
  function DispatchTransform({
    id,
    transform
  }: {
    id: string;
    transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  }) {
    const { dispatch } = useBoard();
    return (
      <button
        data-testid="external-transform-dispatch"
        type="button"
        onClick={() => dispatch({ type: "transformLayer", id, transform })}
      >
        external transform
      </button>
    );
  }

  function DispatchImagePatch({
    id,
    patch
  }: {
    id: string;
    patch: { width?: number; height?: number };
  }) {
    const { dispatch } = useBoard();
    return (
      <button
        data-testid="external-image-dispatch"
        type="button"
        onClick={() => dispatch({ type: "updateImageLayer", id, patch })}
      >
        external resize
      </button>
    );
  }

  it("refreshes transform x/y inputs after external transformLayer dispatch", async () => {
    const user = userEvent.setup();
    render(
      <BoardProvider
        initialDocument={{ layers: [imageLayer], activeLayerId: "img_1" }}
      >
        <BoardInspector />
        <DispatchTransform
          id="img_1"
          transform={{ x: 999, y: 888, scaleX: 1, scaleY: 1, rotation: 0 }}
        />
      </BoardProvider>
    );

    // 起步：imageLayer.transform = baseTransform → x=0, y=0
    expect(screen.getByTestId("board-inspector-x")).toHaveValue(0);
    expect(screen.getByTestId("board-inspector-y")).toHaveValue(0);

    // 模拟 canvas drag → reducer 写 x=999, y=888
    await user.click(screen.getByTestId("external-transform-dispatch"));

    // Inspector 必须跟随 reducer 同步显示新值。
    expect(screen.getByTestId("board-inspector-x")).toHaveValue(999);
    expect(screen.getByTestId("board-inspector-y")).toHaveValue(888);
  });

  it("refreshes image width/height inputs after external updateImageLayer dispatch", async () => {
    const user = userEvent.setup();
    render(
      <BoardProvider
        initialDocument={{ layers: [imageLayer], activeLayerId: "img_1" }}
      >
        <BoardInspector />
        <DispatchImagePatch id="img_1" patch={{ width: 555, height: 444 }} />
      </BoardProvider>
    );

    expect(screen.getByTestId("board-inspector-image-width")).toHaveValue(200);
    expect(screen.getByTestId("board-inspector-image-height")).toHaveValue(200);

    // 模拟 transformerEnd 把 scale 烘进 width/height
    await user.click(screen.getByTestId("external-image-dispatch"));

    expect(screen.getByTestId("board-inspector-image-width")).toHaveValue(555);
    expect(screen.getByTestId("board-inspector-image-height")).toHaveValue(444);
  });
});
