import { describe, expect, it } from "vitest";
import {
  bakeScaleOnKonvaTarget,
  buildDragTransformAction,
  buildTransformEndAction,
  snapshotFromKonvaTarget
} from "@/components/creator/board/board-transform";
import type { BoardImageLayer, BoardStrokeLayer } from "@/lib/creator/board/types";

const baseTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

const imageLayer: BoardImageLayer = {
  id: "img_1",
  name: "img",
  kind: "image",
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 0,
  transform: baseTransform,
  assetId: "asset",
  src: "blob:x",
  width: 200,
  height: 100
};

const strokeLayer: BoardStrokeLayer = {
  id: "stk_1",
  name: "stk",
  kind: "stroke",
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 0,
  transform: baseTransform,
  points: [0, 0, 10, 10],
  brush: { color: "#000", size: 2, mode: "draw" }
};

function konvaShapeStub(values: {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}) {
  return {
    x: () => values.x,
    y: () => values.y,
    scaleX: () => values.scaleX,
    scaleY: () => values.scaleY,
    rotation: () => values.rotation
  };
}

describe("board-transform", () => {
  it("snapshots a Konva-shape-like target", () => {
    const target = konvaShapeStub({ x: 12, y: 34, scaleX: 1.5, scaleY: 2, rotation: 45 });
    expect(snapshotFromKonvaTarget(target)).toEqual({
      x: 12,
      y: 34,
      scaleX: 1.5,
      scaleY: 2,
      rotation: 45
    });
  });

  it("returns null for non-Konva targets (jsdom div fallback)", () => {
    expect(snapshotFromKonvaTarget(null)).toBeNull();
    expect(snapshotFromKonvaTarget({})).toBeNull();
    expect(snapshotFromKonvaTarget(document.createElement("div"))).toBeNull();
  });

  it("buildDragTransformAction only updates x/y", () => {
    const action = buildDragTransformAction(imageLayer, {
      x: 50,
      y: 60,
      scaleX: 2,
      scaleY: 2,
      rotation: 90
    });
    expect(action).toEqual({
      type: "transformLayer",
      id: "img_1",
      transform: { x: 50, y: 60, scaleX: 1, scaleY: 1, rotation: 0 }
    });
  });

  it("buildTransformEndAction bakes scale into width/height for image layers and resets scale", () => {
    const action = buildTransformEndAction(imageLayer, {
      x: 50,
      y: 60,
      scaleX: 1.5,
      scaleY: 2,
      rotation: 30
    });
    expect(action).toEqual({
      type: "transformLayer",
      id: "img_1",
      transform: { x: 50, y: 60, scaleX: 1, scaleY: 1, rotation: 30 },
      width: 300,
      height: 200
    });
  });

  it("buildTransformEndAction does not bake size for non-image layers", () => {
    const action = buildTransformEndAction(strokeLayer, {
      x: 5,
      y: 6,
      scaleX: 3,
      scaleY: 3,
      rotation: 0
    });
    expect(action).toEqual({
      type: "transformLayer",
      id: "stk_1",
      transform: { x: 5, y: 6, scaleX: 1, scaleY: 1, rotation: 0 }
    });
    expect(action).not.toHaveProperty("width");
    expect(action).not.toHaveProperty("height");
  });

  it("bakeScaleOnKonvaTarget no-ops on non-Konva targets", () => {
    expect(() => bakeScaleOnKonvaTarget(null)).not.toThrow();
    expect(() => bakeScaleOnKonvaTarget({})).not.toThrow();
  });

  it("bakeScaleOnKonvaTarget calls scaleX(1)/scaleY(1) on a real-shaped target", () => {
    const calls: Array<[string, number]> = [];
    const target = {
      scaleX: (v?: number) => {
        if (v !== undefined) calls.push(["scaleX", v]);
      },
      scaleY: (v?: number) => {
        if (v !== undefined) calls.push(["scaleY", v]);
      }
    };
    bakeScaleOnKonvaTarget(target);
    expect(calls).toEqual([
      ["scaleX", 1],
      ["scaleY", 1]
    ]);
  });
});
