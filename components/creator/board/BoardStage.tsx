"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Layer, Line, Rect, Stage } from "react-konva";

/**
 * Board Mode · Cut 2 (Phase C, plan slug board-mode-final)
 *
 * 画布壳层。本刀只渲染：背景、网格、空图层占位。
 * - 不实现拖拽、Transformer、图层操作（Cut 3）。
 * - 不对接 /api/images/edits（Cut 4）。
 * - 不持久化 BoardDocument（Cut 5）。
 *
 * 在测试环境下，react-konva 被 vitest.setup.ts 全量 mock 成 <div>，
 * Konva 节点上的 `name` prop 会被 mock 转成 `data-testid`，
 * 让 smoke test 能够断言背景 / 网格 / 空层 anchor 是否真的渲染出来。
 */

const GRID_SIZE = 40;
const BG_FILL = "#f8fafc";
const GRID_STROKE = "#e2e8f0";

type Size = { width: number; height: number };

export function BoardStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });

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

  return (
    <div
      ref={containerRef}
      data-testid="board-stage"
      className="relative h-full min-h-[480px] w-full overflow-hidden rounded-md border border-border bg-card"
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
        <Layer name="board-empty" />
      </Stage>
    </div>
  );
}
