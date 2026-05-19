import type { BoardAction } from "@/lib/creator/board/board-context";
import type { BoardLayer } from "@/lib/creator/board/types";

/**
 * Board Mode · Cut 3 commit 4 (plan slug board-mode-final).
 *
 * 把 Konva 节点的运行时状态转成纯数据 snapshot，再把 snapshot 转成
 * BoardAction。让 transform 逻辑能脱离 Konva 单测（react-konva 在 jsdom
 * 下被 mock 成 div，e.target.x() 等真实接口不存在）。
 */

export type LayerTransformSnapshot = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

type KonvaShapeLike = {
  x: () => number;
  y: () => number;
  scaleX: () => number;
  scaleY: () => number;
  rotation: () => number;
};

export function snapshotFromKonvaTarget(
  target: unknown
): LayerTransformSnapshot | null {
  if (!target || typeof target !== "object") return null;
  const t = target as Partial<KonvaShapeLike>;
  if (
    typeof t.x !== "function" ||
    typeof t.y !== "function" ||
    typeof t.scaleX !== "function" ||
    typeof t.scaleY !== "function" ||
    typeof t.rotation !== "function"
  ) {
    return null;
  }
  return {
    x: t.x(),
    y: t.y(),
    scaleX: t.scaleX(),
    scaleY: t.scaleY(),
    rotation: t.rotation()
  };
}

/**
 * 拖动结束：只更新 x/y，scale + rotation 不动。
 */
export function buildDragTransformAction(
  layer: BoardLayer,
  snapshot: LayerTransformSnapshot
): BoardAction {
  return {
    type: "transformLayer",
    id: layer.id,
    transform: {
      ...layer.transform,
      x: snapshot.x,
      y: snapshot.y
    }
  };
}

/**
 * Transformer 结束：把 scaleX/scaleY 烘进 width/height（仅 image），把
 * scale 重置回 1。这样下一次手势开始时 Konva 不会在已缩放的 node 上叠加。
 */
export function buildTransformEndAction(
  layer: BoardLayer,
  snapshot: LayerTransformSnapshot
): BoardAction {
  const transform = {
    x: snapshot.x,
    y: snapshot.y,
    rotation: snapshot.rotation,
    scaleX: 1,
    scaleY: 1
  };
  if (layer.kind === "image") {
    return {
      type: "transformLayer",
      id: layer.id,
      transform,
      width: Math.max(1, Math.round(layer.width * snapshot.scaleX)),
      height: Math.max(1, Math.round(layer.height * snapshot.scaleY))
    };
  }
  return {
    type: "transformLayer",
    id: layer.id,
    transform
  };
}

/**
 * Konva 在 onTransformEnd 后，节点上还残留着用户手势期间的 scale。生产
 * 代码必须在 dispatch 之前把节点的 scale 重置回 1，否则下一个 frame
 * Konva 会用「老 scale × 新 width」叠加渲染。在 jsdom mock 下 target 是
 * div、没有 scaleX 方法，所以这里要 type-guard。
 */
export function bakeScaleOnKonvaTarget(target: unknown) {
  if (!target || typeof target !== "object") return;
  const t = target as {
    scaleX?: (v?: number) => unknown;
    scaleY?: (v?: number) => unknown;
  };
  if (typeof t.scaleX === "function") t.scaleX(1);
  if (typeof t.scaleY === "function") t.scaleY(1);
}
