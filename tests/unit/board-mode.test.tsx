import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BoardInspector } from "@/components/creator/board/BoardInspector";
import { BoardLayerList } from "@/components/creator/board/BoardLayerList";
import { BoardMode } from "@/components/creator/board";
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

describe("BoardStage text tool (Cut 3 commit 6)", () => {
  it("creates a text layer with default content on canvas click in text mode", async () => {
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

    fireEvent.mouseDown(screen.getByTestId("board-stage"), {
      clientX: 100,
      clientY: 80
    });

    const items = await screen.findByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("文字图层");

    // Konva.Text mock 节点带默认文案
    const textNode = document.querySelector<HTMLElement>(
      "[data-konva-kind=\"Text\"]"
    );
    expect(textNode).not.toBeNull();
  });

  it("does not stack text layers when clicking on an existing layer", async () => {
    const user = userEvent.setup();
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("board-tool-text"));
    fireEvent.mouseDown(screen.getByTestId("board-stage"), {
      clientX: 100,
      clientY: 80
    });

    const firstNode = await waitFor(() => {
      const node = document.querySelector<HTMLElement>(
        "[data-konva-kind=\"Text\"]"
      );
      expect(node).not.toBeNull();
      return node!;
    });

    // 在第一个 text layer 的 Konva mock 节点上再点一次：不应该再创建
    fireEvent.mouseDown(firstNode, { clientX: 105, clientY: 85, bubbles: true });

    const items = screen.getByTestId("board-layer-list-items");
    const rows = items.querySelectorAll<HTMLElement>(
      "[data-testid^='board-layer-row-']"
    );
    expect(rows).toHaveLength(1);
  });

  it("does not create text layers in select mode", async () => {
    render(<BoardMode />);
    await waitFor(() => {
      expect(screen.getByTestId("board-stage")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTestId("board-stage"), {
      clientX: 100,
      clientY: 80
    });

    expect(screen.getByTestId("board-layer-list-empty")).toBeInTheDocument();
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
