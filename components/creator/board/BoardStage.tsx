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
 * Board Mode · Cut 2 + Cut 3 commit 3-5 (plan slug board-mode-final)
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

  // 当前 active layer 是否锁定。Konva Transformer 的 handle 是独立机制，
  // 不看目标节点的 draggable —— 锁定的图层若仍被 transformer.nodes() 持有，
  // 用户可以照常 resize/rotate。所以这里把 locked 显式纳入 transformer 的
  // 附着判断和 visible 判断。
  const activeLayer = state.document.layers.find(
    (l) => l.id === state.document.activeLayerId
  );
  const activeLayerLocked = activeLayer?.locked ?? false;

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
  // 锁定时强制 nodes([])，让 transformer handle 不响应。
  useEffect(() => {
    const transformer = transformerRef.current as
      | (Konva.Transformer & { getLayer?: () => unknown })
      | null;
    if (!transformer) return;
    const node = get(state.document.activeLayerId);
    if (typeof transformer.nodes !== "function") return;
    transformer.nodes(activeLayerLocked || !node ? [] : [node]);
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

  const handleStageClick = (event: { target?: { getStage?: () => unknown } }) => {
    if (state.activeTool !== "select") return;
    // 点击空白处 → 取消选中。Konva: e.target === stage 时表示空击。
    const target = event.target;
    if (target && typeof target.getStage === "function") {
      if (target.getStage() === target) {
        dispatch({ type: "selectLayer", id: null });
      }
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
    if (state.activeTool === "text") {
      // Text 工具：单击空白处创建一个默认 text layer。编辑放 commit 7
      // 的 BoardInspector，本刀不实现 inline contentEditable。
      const target = event.target as HTMLElement | null;
      // 只在落在 stage 容器自身或 background fill 上时创建，点到现有
      // layer 的 Konva mock 节点上不创建（避免和点选冲突）。
      const onExistingLayer = !!target?.closest("[data-testid^='board-layer-']");
      if (onExistingLayer) return;
      const { x, y } = pointerPos(event);
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
      return;
    }
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
              !activeLayerLocked
            }
          />
        </Layer>
      </Stage>
    </div>
  );
}
