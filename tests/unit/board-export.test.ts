import { beforeEach, describe, expect, it, vi } from "vitest";

import { exportBoardToPng } from "@/lib/creator/board/board-export";

/**
 * Cut 4.1 (plan slug 2026-05-20-board-mode-cut4-plan).
 *
 * jsdom 没有真实 canvas / atob 行为足够，但需要 fake Konva.Stage 来覆盖
 * helper 行为：
 * - toDataURL 调用参数透传
 * - helper layer (board-background / board-grid) 在导出前后被隐藏并还原
 * - 非 helper layer 不动
 * - dataURL → Blob 的 base64 解析
 */

type FakeLayer = {
  _name: string;
  _visible: boolean;
  name: () => string;
  visible: ((next?: boolean) => boolean | void) & {
    mock?: ReturnType<typeof vi.fn>;
  };
};

function fakeLayer(name: string, initialVisible = true): FakeLayer {
  let value = initialVisible;
  const visible = vi.fn((next?: boolean) => {
    if (next === undefined) return value;
    value = next;
  });
  return {
    _name: name,
    get _visible() {
      return value;
    },
    name: () => name,
    visible: visible as unknown as FakeLayer["visible"]
  };
}

function fakeStage(opts: {
  layers: FakeLayer[];
  width?: number;
  height?: number;
  dataUrl?: string;
  toDataURLImpl?: (args: { mimeType: string; pixelRatio: number }) => string;
}) {
  const dataUrl =
    opts.dataUrl ??
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9X8M+TwAAAAASUVORK5CYII=";
  const toDataURL = vi.fn(opts.toDataURLImpl ?? (() => dataUrl));
  return {
    width: () => opts.width ?? 800,
    height: () => opts.height ?? 600,
    getLayers: () => opts.layers,
    toDataURL
  } as unknown as Parameters<typeof exportBoardToPng>[0] & {
    toDataURL: ReturnType<typeof vi.fn>;
  };
}

describe("exportBoardToPng", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Konva.Stage.toDataURL with image/png and the provided pixelRatio", () => {
    const stage = fakeStage({ layers: [] });
    exportBoardToPng(stage, { pixelRatio: 2 });
    expect(stage.toDataURL).toHaveBeenCalledTimes(1);
    expect(stage.toDataURL).toHaveBeenCalledWith({
      mimeType: "image/png",
      pixelRatio: 2
    });
  });

  it("defaults to pixelRatio 1 and image/png", () => {
    const stage = fakeStage({ layers: [] });
    exportBoardToPng(stage);
    expect(stage.toDataURL).toHaveBeenCalledWith({
      mimeType: "image/png",
      pixelRatio: 1
    });
  });

  it("hides helper layers (background / grid) before export and restores them after", () => {
    const bg = fakeLayer("board-background");
    const grid = fakeLayer("board-grid");
    const user = fakeLayer("board-empty");
    let visibilitiesAtExport: Record<string, boolean> = {};
    const stage = fakeStage({
      layers: [bg, grid, user],
      toDataURLImpl: () => {
        visibilitiesAtExport = {
          [bg._name]: bg._visible,
          [grid._name]: grid._visible,
          [user._name]: user._visible
        };
        return "data:image/png;base64,AAAA";
      }
    });

    exportBoardToPng(stage);

    // 导出过程中 helper layer 必须不可见
    expect(visibilitiesAtExport["board-background"]).toBe(false);
    expect(visibilitiesAtExport["board-grid"]).toBe(false);
    // 用户层不动
    expect(visibilitiesAtExport["board-empty"]).toBe(true);
    // 导出后 helper layer visibility 恢复回 true
    expect(bg._visible).toBe(true);
    expect(grid._visible).toBe(true);
    expect(user._visible).toBe(true);
  });

  it("restores layer visibility even when toDataURL throws (e.g. tainted canvas)", () => {
    const bg = fakeLayer("board-background");
    const stage = fakeStage({
      layers: [bg],
      toDataURLImpl: () => {
        throw new Error("tainted canvas");
      }
    });

    expect(() => exportBoardToPng(stage)).toThrow("tainted canvas");
    expect(bg._visible).toBe(true);
  });

  it("returns dataUrl, image/png Blob, and width/height scaled by pixelRatio", () => {
    const stage = fakeStage({
      layers: [],
      width: 320,
      height: 240,
      dataUrl: "data:image/png;base64,AAEC"
    });

    const result = exportBoardToPng(stage, { pixelRatio: 2 });
    expect(result.dataUrl).toBe("data:image/png;base64,AAEC");
    expect(result.blob.type).toBe("image/png");
    // 0x00 0x01 0x02 → 3 字节
    expect(result.blob.size).toBe(3);
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
  });

  it("respects custom excludeLayerNames (empty array hides nothing)", () => {
    const bg = fakeLayer("board-background");
    let bgVisibilityAtExport = true;
    const stage = fakeStage({
      layers: [bg],
      toDataURLImpl: () => {
        bgVisibilityAtExport = bg._visible;
        return "data:image/png;base64,AAAA";
      }
    });

    exportBoardToPng(stage, { excludeLayerNames: [] });
    expect(bgVisibilityAtExport).toBe(true);
    expect(bg.visible as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalledWith(false);
  });

  it("throws on a clearly malformed data URL", () => {
    const stage = fakeStage({
      layers: [],
      toDataURLImpl: () => "not-a-data-url"
    });
    expect(() => exportBoardToPng(stage)).toThrow(/invalid data URL/);
  });
});
