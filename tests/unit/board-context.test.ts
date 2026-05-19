import { describe, expect, it, vi } from "vitest";
import {
  boardReducer,
  createInitialBoardState,
  type BoardState
} from "@/lib/creator/board/board-context";
import type {
  BoardImageLayer,
  BoardStrokeLayer,
  BoardTextLayer
} from "@/lib/creator/board/types";

const baseTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0
};

const imageLayer: BoardImageLayer = {
  id: "img_1",
  name: "Image",
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
  name: "Stroke",
  kind: "stroke",
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 0,
  transform: baseTransform,
  points: [10, 10, 20, 20],
  brush: { color: "#000000", size: 4, mode: "draw" }
};

const textLayer: BoardTextLayer = {
  id: "txt_1",
  name: "Text",
  kind: "text",
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

function freshState(): BoardState {
  return createInitialBoardState({ id: "board_1", projectId: "p", sessionId: "s" });
}

describe("board-context reducer", () => {
  it("seeds an empty document with select tool", () => {
    const s = freshState();
    expect(s.document.layers).toEqual([]);
    expect(s.document.activeLayerId).toBeNull();
    expect(s.activeTool).toBe("select");
  });

  it("adds a layer and selects it", () => {
    const s = boardReducer(freshState(), { type: "addLayer", layer: imageLayer });
    expect(s.document.layers).toHaveLength(1);
    expect(s.document.activeLayerId).toBe("img_1");
  });

  it("removes a layer and clears activeLayerId when it was the active one", () => {
    let s = boardReducer(freshState(), { type: "addLayer", layer: imageLayer });
    s = boardReducer(s, { type: "removeLayer", id: "img_1" });
    expect(s.document.layers).toHaveLength(0);
    expect(s.document.activeLayerId).toBeNull();
  });

  it("preserves activeLayerId when removing a different layer", () => {
    let s = boardReducer(freshState(), { type: "addLayer", layer: imageLayer });
    s = boardReducer(s, { type: "addLayer", layer: strokeLayer });
    // active is strokeLayer now; remove the image -> active stays
    s = boardReducer(s, { type: "removeLayer", id: "img_1" });
    expect(s.document.activeLayerId).toBe("stk_1");
  });

  it("selects an explicit layer (or null)", () => {
    let s = boardReducer(freshState(), { type: "addLayer", layer: imageLayer });
    s = boardReducer(s, { type: "addLayer", layer: strokeLayer });
    s = boardReducer(s, { type: "selectLayer", id: "img_1" });
    expect(s.document.activeLayerId).toBe("img_1");
    s = boardReducer(s, { type: "selectLayer", id: null });
    expect(s.document.activeLayerId).toBeNull();
  });

  it("toggles visibility and lock", () => {
    let s = boardReducer(freshState(), { type: "addLayer", layer: imageLayer });
    s = boardReducer(s, { type: "toggleVisible", id: "img_1" });
    expect(s.document.layers[0].visible).toBe(false);
    s = boardReducer(s, { type: "toggleLock", id: "img_1" });
    expect(s.document.layers[0].locked).toBe(true);
  });

  it("reorders layers by index, clamping out-of-range targets", () => {
    let s = freshState();
    s = boardReducer(s, { type: "addLayer", layer: imageLayer });
    s = boardReducer(s, { type: "addLayer", layer: strokeLayer });
    s = boardReducer(s, { type: "addLayer", layer: textLayer });
    // layers order: img, stk, txt
    s = boardReducer(s, { type: "reorderLayer", id: "txt_1", toIndex: 0 });
    expect(s.document.layers.map((l) => l.id)).toEqual(["txt_1", "img_1", "stk_1"]);
    // clamp upper bound
    s = boardReducer(s, { type: "reorderLayer", id: "txt_1", toIndex: 999 });
    expect(s.document.layers.map((l) => l.id)).toEqual(["img_1", "stk_1", "txt_1"]);
  });

  it("changes active tool", () => {
    let s = freshState();
    s = boardReducer(s, { type: "setActiveTool", tool: "stroke" });
    expect(s.activeTool).toBe("stroke");
  });

  it("transforms a layer (and writes width/height for image)", () => {
    let s = boardReducer(freshState(), { type: "addLayer", layer: imageLayer });
    const next = { x: 50, y: 60, scaleX: 1, scaleY: 1, rotation: 90 };
    s = boardReducer(s, {
      type: "transformLayer",
      id: "img_1",
      transform: next,
      width: 300,
      height: 400
    });
    const updated = s.document.layers[0] as BoardImageLayer;
    expect(updated.transform).toEqual(next);
    expect(updated.width).toBe(300);
    expect(updated.height).toBe(400);
  });

  it("updates kind-specific patches without touching other kinds", () => {
    let s = freshState();
    s = boardReducer(s, { type: "addLayer", layer: imageLayer });
    s = boardReducer(s, { type: "addLayer", layer: strokeLayer });
    s = boardReducer(s, { type: "addLayer", layer: textLayer });

    s = boardReducer(s, {
      type: "updateImageLayer",
      id: "img_1",
      patch: { width: 999 }
    });
    s = boardReducer(s, {
      type: "updateStrokeLayer",
      id: "stk_1",
      patch: { brush: { color: "#ff0000", size: 8, mode: "draw" } }
    });
    s = boardReducer(s, {
      type: "updateTextLayer",
      id: "txt_1",
      patch: { text: "world", fontSize: 24 }
    });

    expect((s.document.layers[0] as BoardImageLayer).width).toBe(999);
    expect((s.document.layers[1] as BoardStrokeLayer).brush.color).toBe("#ff0000");
    expect((s.document.layers[2] as BoardTextLayer).text).toBe("world");
    expect((s.document.layers[2] as BoardTextLayer).fontSize).toBe(24);

    // wrong-kind patches are no-ops
    s = boardReducer(s, {
      type: "updateImageLayer",
      id: "stk_1",
      patch: { width: 1 }
    });
    expect((s.document.layers[1] as BoardStrokeLayer).kind).toBe("stroke");
  });

  it("touches updatedAt on mutating actions", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-05-19T00:00:00.000Z"));
      const s0 = freshState();
      vi.setSystemTime(new Date("2026-05-19T00:00:01.000Z"));
      const s1 = boardReducer(s0, { type: "addLayer", layer: imageLayer });
      expect(s1.document.updatedAt).not.toBe(s0.document.updatedAt);
    } finally {
      vi.useRealTimers();
    }
  });
});
