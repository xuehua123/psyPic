"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage } from "react-konva";

import { useImageSource } from "./use-image-source";
import { useBoard } from "@/lib/creator/board/board-context";
import {
  LIBRARY_ASSET_DRAG_MIME,
  readLibraryAssetDragData
} from "@/lib/creator/board/library-drag";
import type { BoardImageLayer, BoardLayer } from "@/lib/creator/board/types";

/**
 * Board Mode · Cut 2 + Cut 3 commit 3 (plan slug board-mode-final)
 *
 * 画布壳层。本刀：背景、网格、用户图层 slot；接 HTML5 drop 从 LibrarySection
 * 拖入素材生成 BoardImageLayer。
 *
 * - 不实现选中、Transformer（Cut 3 commit 4）。
 * - 不实现笔画 / 文字（Cut 3 commit 5/6）。
 * - 不对接 /api/images/edits（Cut 4）。
 * - 不持久化 BoardDocument（Cut 5）。
 *
 * 在测试环境下，react-konva 被 vitest.setup.ts 全量 mock 成 <div>，
 * Konva 节点上的 `name` prop 会被 mock 转成 `data-testid`，
 * smoke test 可断言每个 layer 的 anchor 是否真的渲染出来。
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

function BoardImageLayerNode({ layer }: { layer: BoardImageLayer }) {
  const [image] = useImageSource(layer.src);
  return (
    <KonvaImage
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
    />
  );
}

function renderLayerNode(layer: BoardLayer) {
  if (layer.kind === "image") {
    return <BoardImageLayerNode key={layer.id} layer={layer} />;
  }
  // stroke / text / mask 在后续 commits 接入
  return null;
}

export function BoardStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });
  const { state, dispatch } = useBoard();

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

  return (
    <div
      ref={containerRef}
      data-testid="board-stage"
      className="relative h-full min-h-[480px] w-full overflow-hidden rounded-md border border-border bg-card"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Stage width={size.width} height={size.height}>
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
          {state.document.layers.map((layer) => renderLayerNode(layer))}
        </Layer>
      </Stage>
    </div>
  );
}
