"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text as KonvaText,
  Transformer
} from "react-konva";

import {
  bakeScaleOnKonvaTarget,
  buildDragTransformAction,
  buildTransformEndAction,
  snapshotFromKonvaTarget
} from "./board-transform";
import { useImageSource } from "./use-image-source";
import { useLayerNodeRegistry } from "./use-layer-node-registry";
import { useBoard } from "@/lib/creator/board/board-context";
import {
  LIBRARY_ASSET_DRAG_MIME,
  readLibraryAssetDragData
} from "@/lib/creator/board/library-drag";
import type {
  BoardImageLayer,
  BoardLayer,
  BoardStrokeLayer,
  BoardTextLayer
} from "@/lib/creator/board/types";

/**
 * Board Mode · Cut 2 + Cut 3 commit 3-5 + Cut 3.1.2 (plan slug board-mode-final)
 *
 * 画布壳层。本刀（commit 5）：stroke 工具 — 在 stroke 模式下按下、拖动、
 * 抬起 mouse，逐步在 reducer 里写一个新的 BoardStrokeLayer，points 实时
 * 追加。
 *
 * - 不实现 eraser / mask（Cut 5）。
 * - 不实现 text / inline edit（commit 6 只创建 text layer，编辑放
 *   commit 7 的 BoardInspector）。
 * - 不对接 /api/images/edits（Cut 4）。
 * - 不持久化 BoardDocument（Cut 5）。
 *
 * Cut 3.1.2 (text hit-testing)：
 *   text 工具不再在 container mouseDown 里靠 `target.closest()` 判定 —
 *   生产 Konva 渲染到 canvas，DOM 树里没有 layer 节点，closest 永远
 *   false → 在已有 text 上叠加新 text。改走 Konva Stage onClick：
 *   - 真实 Konva：`e.target.getStage() === e.target` 表示空白点击。
 *   - jsdom mock：fallback 到 `e.target === e.currentTarget` (Stage div
 *     的 onClick listener 上 currentTarget 就是 Stage 本体)。
 *   位置：真实 Konva 拿 `Stage.getPointerPosition()`；mock 退到
 *   `pointerPos(e.clientX, e.clientY)`。
 */

const GRID_SIZE = 40;
const BG_FILL = "#f8fafc";
const GRID_STROKE = "#e2e8f0";

const DEFAULT_DROP_WIDTH = 320;
const DEFAULT_DROP_HEIGHT = 320;

const DEFAULT_STROKE_COLOR = "#0c7a6f";
const DEFAULT_STROKE_SIZE = 4;

const DEFAULT_TEXT_VALUE = "双击编辑文字";
const DEFAULT_TEXT_FONT_SIZE = 24;
const DEFAULT_TEXT_FONT_FAMILY = "system-ui";
const DEFAULT_TEXT_FILL = "#101620";

function generateLayerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `layer_${crypto.randomUUID()}`;
  }
  return `layer_${Math.random().toString(36).slice(2)}`;
}

type Size = { width: number; height: number };

type LayerNodeProps<L extends BoardLayer> = {
  layer: L;
  isActive: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onDragEnd: (layer: L, target: unknown) => void;
  onTransformEnd: (layer: L, target: unknown) => void;
};

function BoardImageLayerNode({
  layer,
  registerNode,
  onSelect,
  onDragEnd,
  onTransformEnd
}: LayerNodeProps<BoardImageLayer>) {
  const [image] = useImageSource(layer.src);
  return (
    <KonvaImage
      ref={(node: Konva.Node | null) => registerNode(layer.id, node)}
      name={`board-layer-${layer.id}`}
      image={image}
      x={layer.transform.x}
      y={layer.transform.y}
      width={layer.width}
      height={layer.height}
      scaleX={layer.transform.scaleX}
      scaleY={layer.transform.scaleY}
      rotation={layer.transform.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      onClick={() => onSelect(layer.id)}
      onTap={() => onSelect(layer.id)}
      onDragEnd={(e: { target?: unknown }) => onDragEnd(layer, e.target)}
      onTransformEnd={(e: { target?: unknown }) => onTransformEnd(layer, e.target)}
    />
  );
}

function BoardStrokeLayerNode({
  layer,
  registerNode,
  onSelect,
  onDragEnd,
  onTransformEnd
}: LayerNodeProps<BoardStrokeLayer>) {
  return (
    <Line
      ref={(node: Konva.Node | null) => registerNode(layer.id, node)}
      name={`board-layer-${layer.id}`}
      points={layer.points}
      stroke={layer.brush.color}
      strokeWidth={layer.brush.size}
      lineCap="round"
      lineJoin="round"
      tension={0.3}
      x={layer.transform.x}
      y={layer.transform.y}
      scaleX={layer.transform.scaleX}
      scaleY={layer.transform.scaleY}
      rotation={layer.transform.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      onClick={() => onSelect(layer.id)}
      onTap={() => onSelect(layer.id)}
      onDragEnd={(e: { target?: unknown }) => onDragEnd(layer, e.target)}
      onTransformEnd={(e: { target?: unknown }) => onTransformEnd(layer, e.target)}
    />
  );
}

function BoardTextLayerNode({
  layer,
  registerNode,
  onSelect,
  onDragEnd,
  onTransformEnd
}: LayerNodeProps<BoardTextLayer>) {
  return (
    <KonvaText
      ref={(node: Konva.Node | null) => registerNode(layer.id, node)}
      name={`board-layer-${layer.id}`}
      text={layer.text}
      fontSize={layer.fontSize}
      fontFamily={layer.fontFamily}
      fill={layer.fill}
      x={layer.transform.x}
      y={layer.transform.y}
      scaleX={layer.transform.scaleX}
      scaleY={layer.transform.scaleY}
      rotation={layer.transform.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      onClick={() => onSelect(layer.id)}
      onTap={() => onSelect(layer.id)}
      onDragEnd={(e: { target?: unknown }) => onDragEnd(layer, e.target)}
      onTransformEnd={(e: { target?: unknown }) => onTransformEnd(layer, e.target)}
    />
  );
}

type LayerRendererProps = {
  layer: BoardLayer;
  isActive: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onDragEnd: (layer: BoardLayer, target: unknown) => void;
  onTransformEnd: (layer: BoardLayer, target: unknown) => void;
};

function renderLayerNode(props: LayerRendererProps) {
  const { layer } = props;
  if (layer.kind === "image") {
    return (
      <BoardImageLayerNode
        key={layer.id}
        layer={layer}
        isActive={props.isActive}
        registerNode={props.registerNode}
        onSelect={props.onSelect}
        onDragEnd={(l, t) => props.onDragEnd(l, t)}
        onTransformEnd={(l, t) => props.onTransformEnd(l, t)}
      />
    );
  }
  if (layer.kind === "stroke") {
    return (
      <BoardStrokeLayerNode
        key={layer.id}
        layer={layer}
        isActive={props.isActive}
        registerNode={props.registerNode}
        onSelect={props.onSelect}
        onDragEnd={(l, t) => props.onDragEnd(l, t)}
        onTransformEnd={(l, t) => props.onTransformEnd(l, t)}
      />
    );
  }
  if (layer.kind === "text") {
    return (
      <BoardTextLayerNode
        key={layer.id}
        layer={layer}
        isActive={props.isActive}
        registerNode={props.registerNode}
        onSelect={props.onSelect}
        onDragEnd={(l, t) => props.onDragEnd(l, t)}
        onTransformEnd={(l, t) => props.onTransformEnd(l, t)}
      />
    );
  }
  // mask 在 Cut 5 接入
  return null;
}

export function BoardStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const { state, dispatch } = useBoard();
  const { register, get } = useLayerNodeRegistry();
  // 正在绘制的 stroke：layer id + 已采集的 points。drawing!=null 时
  // mouse move 把新点 append 进去并 dispatch updateStrokeLayer。
  const [drawing, setDrawing] = useState<
    { id: string; points: number[] } | null
  >(null);

  // 当前 active layer 是否锁定 / 不可见。Konva Transformer 的 handle 是
  // 独立机制，不看目标节点的 draggable / visible —— 锁定或隐藏的图层若
  // 仍被 transformer.nodes() 持有，用户可以照常 resize/rotate 或在画布
  // 上看到孤儿选框。所以这里把 locked / visible 显式纳入 transformer 的
  // 附着判断和 visible 判断。
  const activeLayer = state.document.layers.find(
    (l) => l.id === state.document.activeLayerId
  );
  const activeLayerLocked = activeLayer?.locked ?? false;
  const activeLayerVisible = activeLayer?.visible ?? true;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // activeLayerId 变化 → 把 Transformer 附着到目标 Konva 节点。
  // jsdom mock 下 transformerRef.current 不是真 Konva.Transformer，
  // 调用 .nodes() / .getLayer() 时会 throw —— 用 type-guard 兜底。
  // 锁定 / 隐藏时强制 nodes([])，让 transformer handle 不响应也不残留。
  useEffect(() => {
    const transformer = transformerRef.current as
      | (Konva.Transformer & { getLayer?: () => unknown })
      | null;
    if (!transformer) return;
    const node = get(state.document.activeLayerId);
    if (typeof transformer.nodes !== "function") return;
    const detach = activeLayerLocked || !activeLayerVisible || !node;
    transformer.nodes(detach ? [] : [node]);
    if (typeof transformer.getLayer === "function") {
      const layer = transformer.getLayer() as
        | { batchDraw?: () => void }
        | null
        | undefined;
      layer?.batchDraw?.();
    }
  }, [
    state.document.activeLayerId,
    state.document.layers,
    activeLayerLocked,
    activeLayerVisible,
    get
  ]);

  const verticalLines: number[][] = [];
  for (let x = 0; x <= size.width; x += GRID_SIZE) {
    verticalLines.push([x, 0, x, size.height]);
  }
  const horizontalLines: number[][] = [];
  for (let y = 0; y <= size.height; y += GRID_SIZE) {
    horizontalLines.push([0, y, size.width, y]);
  }

  const pointerPos = (event: { clientX: number; clientY: number }) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: size.width / 2, y: size.height / 2 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes(LIBRARY_ASSET_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const payload = readLibraryAssetDragData(event.dataTransfer);
    if (!payload) return;
    event.preventDefault();

    const { x, y } = pointerPos(event);
    const layer: BoardImageLayer = {
      id: generateLayerId(),
      name: payload.name ?? "图片图层",
      kind: "image",
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: state.document.layers.length,
      transform: {
        x: x - DEFAULT_DROP_WIDTH / 2,
        y: y - DEFAULT_DROP_HEIGHT / 2,
        scaleX: 1,
        scaleY: 1,
        rotation: 0
      },
      assetId: payload.assetId,
      src: payload.url,
      width: DEFAULT_DROP_WIDTH,
      height: DEFAULT_DROP_HEIGHT
    };
    dispatch({ type: "addLayer", layer });
  };

  const handleStageClick = (event: {
    target?: unknown;
    clientX?: number;
    clientY?: number;
  }) => {
    const t = event.target;

    // 命中检测：判断点击是否落在「用户添加的图层」上。
    // - 真实 Konva：每个 layer 节点带 name="board-layer-${id}"，
    //   target.name() 返回这个字符串。
    // - jsdom mock：每个 layer 节点渲染成 <div data-testid="board-layer-${id}">。
    // 背景 / 网格 / Stage 自身不以 "board-layer-" 开头 → 视为空白。
    // 不能再用旧的 `target.getStage() === target`：背景是 Rect，不是 Stage，
    // 旧判断会把背景误判成「非空」。
    // 参数用 `target?: unknown` 是为了同时兼容 onClick(KonvaEventObject<MouseEvent>)
    // 和 onTap(KonvaEventObject<TouchEvent>)，内部再 type-guard 收窄。
    let onUserLayer = false;
    if (t && typeof t === "object") {
      const konvaTarget = t as { name?: () => string };
      if (typeof konvaTarget.name === "function") {
        onUserLayer = konvaTarget.name().startsWith("board-layer-");
      } else {
        const dom = t as HTMLElement;
        const testid = dom.dataset?.testid ?? "";
        onUserLayer = testid.startsWith("board-layer-");
      }
    }
    const onEmpty = !onUserLayer;

    if (state.activeTool === "select") {
      if (onEmpty) {
        dispatch({ type: "selectLayer", id: null });
      }
      return;
    }

    if (state.activeTool === "text" && onEmpty) {
      // 落点：优先 Konva Stage.getPointerPosition()（真实运行时），退到
      // React synthetic event 的 clientX/Y（jsdom fireEvent.click 路径）。
      let x = size.width / 2;
      let y = size.height / 2;
      const stage =
        t &&
        typeof t === "object" &&
        typeof (t as { getStage?: () => unknown }).getStage === "function"
          ? ((t as { getStage: () => unknown }).getStage() as {
              getPointerPosition?: () => { x: number; y: number } | null;
            } | null)
          : null;
      const stagePointer = stage?.getPointerPosition?.() ?? null;
      if (stagePointer) {
        x = stagePointer.x;
        y = stagePointer.y;
      } else if (
        typeof event.clientX === "number" &&
        typeof event.clientY === "number"
      ) {
        const p = pointerPos({
          clientX: event.clientX,
          clientY: event.clientY
        });
        x = p.x;
        y = p.y;
      }

      const id = generateLayerId();
      const newLayer: BoardTextLayer = {
        id,
        name: "文字图层",
        kind: "text",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: state.document.layers.length,
        transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0 },
        text: DEFAULT_TEXT_VALUE,
        fontSize: DEFAULT_TEXT_FONT_SIZE,
        fontFamily: DEFAULT_TEXT_FONT_FAMILY,
        fill: DEFAULT_TEXT_FILL
      };
      dispatch({ type: "addLayer", layer: newLayer });
    }
  };

  const handleSelect = (id: string) => {
    if (state.activeTool !== "select") return;
    dispatch({ type: "selectLayer", id });
  };

  const handleLayerDragEnd = (layer: BoardLayer, target: unknown) => {
    const snapshot = snapshotFromKonvaTarget(target);
    if (!snapshot) return;
    dispatch(buildDragTransformAction(layer, snapshot));
  };

  const handleLayerTransformEnd = (layer: BoardLayer, target: unknown) => {
    const snapshot = snapshotFromKonvaTarget(target);
    if (!snapshot) return;
    bakeScaleOnKonvaTarget(target);
    dispatch(buildTransformEndAction(layer, snapshot));
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (state.activeTool === "stroke") {
      const { x, y } = pointerPos(event);
      const id = generateLayerId();
      const newLayer: BoardStrokeLayer = {
        id,
        name: "笔画图层",
        kind: "stroke",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: state.document.layers.length,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        points: [x, y],
        brush: {
          color: DEFAULT_STROKE_COLOR,
          size: DEFAULT_STROKE_SIZE,
          mode: "draw"
        }
      };
      dispatch({ type: "addLayer", layer: newLayer });
      setDrawing({ id, points: [x, y] });
      return;
    }
    // text 工具的落点改走 Konva Stage onClick + 命中检测，见 handleStageClick。
    // 这里保留 stroke 的 mouseDown 起绘逻辑。
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!drawing) return;
    const { x, y } = pointerPos(event);
    const nextPoints = [...drawing.points, x, y];
    setDrawing({ ...drawing, points: nextPoints });
    dispatch({
      type: "updateStrokeLayer",
      id: drawing.id,
      patch: { points: nextPoints }
    });
  };

  const handleMouseUp = () => {
    if (drawing) setDrawing(null);
  };

  return (
    <div
      ref={containerRef}
      data-testid="board-stage"
      data-active-tool={state.activeTool}
      data-active-layer-locked={activeLayerLocked ? "true" : "false"}
      data-active-layer-visible={activeLayerVisible ? "true" : "false"}
      className="relative h-full min-h-[480px] w-full overflow-hidden rounded-md border border-border bg-card"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Stage
        width={size.width}
        height={size.height}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer name="board-background">
          <Rect
            name="board-background-fill"
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            fill={BG_FILL}
          />
        </Layer>
        <Layer name="board-grid">
          <Group name="board-grid-group">
            {verticalLines.map((points, i) => (
              <Line key={`v-${i}`} points={points} stroke={GRID_STROKE} strokeWidth={1} />
            ))}
            {horizontalLines.map((points, i) => (
              <Line key={`h-${i}`} points={points} stroke={GRID_STROKE} strokeWidth={1} />
            ))}
          </Group>
        </Layer>
        <Layer name="board-empty">
          {state.document.layers.map((layer) =>
            renderLayerNode({
              layer,
              isActive: state.document.activeLayerId === layer.id,
              registerNode: register,
              onSelect: handleSelect,
              onDragEnd: handleLayerDragEnd,
              onTransformEnd: handleLayerTransformEnd
            })
          )}
          <Transformer
            ref={transformerRef}
            name="board-transformer"
            rotateEnabled
            keepRatio={false}
            visible={
              state.activeTool === "select" &&
              state.document.activeLayerId !== null &&
              !activeLayerLocked &&
              activeLayerVisible
            }
          />
        </Layer>
      </Stage>
    </div>
  );
}
