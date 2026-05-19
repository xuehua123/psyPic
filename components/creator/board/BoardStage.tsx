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
import type { BoardImageLayer, BoardLayer } from "@/lib/creator/board/types";

/**
 * Board Mode · Cut 2 + Cut 3 commit 3-4 (plan slug board-mode-final)
 *
 * 画布壳层。本刀（commit 4）：选中 + Konva Transformer + 拖动 / 缩放 /
 * 旋转结束写回 reducer。
 *
 * - 不实现笔画 / 文字（Cut 3 commit 5/6）。
 * - 不对接 /api/images/edits（Cut 4）。
 * - 不持久化 BoardDocument（Cut 5）。
 *
 * 在测试环境下，react-konva 被 vitest.setup.ts 全量 mock 成 <div>，
 * Konva 节点的 `name` prop 转成 `data-testid`，事件 prop（onClick /
 * onDragEnd / onTransformEnd 等）直接保留为 React handler。Transform
 * 助手都做了 KonvaShapeLike type-guard，能在 div mock 下安全降级。
 */

const GRID_SIZE = 40;
const BG_FILL = "#f8fafc";
const GRID_STROKE = "#e2e8f0";

const DEFAULT_DROP_WIDTH = 320;
const DEFAULT_DROP_HEIGHT = 320;

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
  isActive,
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
      data-active={isActive ? "true" : "false"}
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
  // stroke / text / mask 在后续 commits 接入
  return null;
}

export function BoardStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const { state, dispatch } = useBoard();
  const { register, get } = useLayerNodeRegistry();

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
  useEffect(() => {
    const transformer = transformerRef.current as
      | (Konva.Transformer & { getLayer?: () => unknown })
      | null;
    if (!transformer) return;
    const node = get(state.document.activeLayerId);
    if (typeof transformer.nodes !== "function") return;
    transformer.nodes(node ? [node] : []);
    if (typeof transformer.getLayer === "function") {
      const layer = transformer.getLayer() as
        | { batchDraw?: () => void }
        | null
        | undefined;
      layer?.batchDraw?.();
    }
  }, [state.document.activeLayerId, state.document.layers, get]);

  const verticalLines: number[][] = [];
  for (let x = 0; x <= size.width; x += GRID_SIZE) {
    verticalLines.push([x, 0, x, size.height]);
  }
  const horizontalLines: number[][] = [];
  for (let y = 0; y <= size.height; y += GRID_SIZE) {
    horizontalLines.push([0, y, size.width, y]);
  }

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

    const rect = containerRef.current?.getBoundingClientRect();
    const dropX = rect ? event.clientX - rect.left : size.width / 2;
    const dropY = rect ? event.clientY - rect.top : size.height / 2;

    const layer: BoardImageLayer = {
      id: generateLayerId(),
      name: payload.name ?? "图片图层",
      kind: "image",
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: state.document.layers.length,
      transform: {
        x: dropX - DEFAULT_DROP_WIDTH / 2,
        y: dropY - DEFAULT_DROP_HEIGHT / 2,
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
    // 点击空白处 → 取消选中。Konva: e.target === stage 时表示空击。
    const target = event.target;
    if (target && typeof target.getStage === "function") {
      if (target.getStage() === target) {
        dispatch({ type: "selectLayer", id: null });
      }
    }
  };

  const handleSelect = (id: string) => {
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

  return (
    <div
      ref={containerRef}
      data-testid="board-stage"
      className="relative h-full min-h-[480px] w-full overflow-hidden rounded-md border border-border bg-card"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
            visible={state.document.activeLayerId !== null}
          />
        </Layer>
      </Stage>
    </div>
  );
}
