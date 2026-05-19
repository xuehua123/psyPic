import { describe, expect, it } from "vitest";
import {
  LIBRARY_ASSET_DRAG_MIME,
  libraryAssetDragPayload,
  readLibraryAssetDragData,
  setLibraryAssetDragData
} from "@/lib/creator/board/library-drag";

/** Minimal DataTransfer stub that round-trips data + types. */
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

describe("library-drag protocol", () => {
  it("builds a payload using prompt as the layer name when available", () => {
    const payload = libraryAssetDragPayload({
      asset_id: "asset_1",
      url: "https://example.com/a.png",
      prompt: "营销首页 hero"
    });
    expect(payload).toEqual({
      assetId: "asset_1",
      url: "https://example.com/a.png",
      name: "营销首页 hero"
    });
  });

  it("falls back to asset_id when prompt is empty", () => {
    const payload = libraryAssetDragPayload({
      asset_id: "asset_1",
      url: "https://example.com/a.png",
      prompt: ""
    });
    expect(payload.name).toBe("asset_1");
  });

  it("round-trips through DataTransfer", () => {
    const dt = createDataTransferStub();
    const payload = libraryAssetDragPayload({
      asset_id: "asset_1",
      url: "https://example.com/a.png",
      prompt: "demo"
    });
    setLibraryAssetDragData(dt, payload);
    expect(dt.types).toContain(LIBRARY_ASSET_DRAG_MIME);
    expect(readLibraryAssetDragData(dt)).toEqual(payload);
  });

  it("returns null for non-asset drags", () => {
    const dt = createDataTransferStub();
    dt.setData("text/plain", "not an asset");
    expect(readLibraryAssetDragData(dt)).toBeNull();
  });

  it("returns null for malformed payloads", () => {
    const dt = createDataTransferStub();
    dt.setData(LIBRARY_ASSET_DRAG_MIME, "{not json");
    expect(readLibraryAssetDragData(dt)).toBeNull();
  });

  it("returns null when payload is missing required fields", () => {
    const dt = createDataTransferStub();
    dt.setData(LIBRARY_ASSET_DRAG_MIME, JSON.stringify({ assetId: "asset_1" }));
    expect(readLibraryAssetDragData(dt)).toBeNull();
  });
});
