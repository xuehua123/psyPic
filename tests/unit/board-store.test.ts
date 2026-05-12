import { describe, expect, it, beforeEach } from "vitest";
import {
  saveBoardDocument,
  getBoardDocument,
  listBoardDocuments,
  softDeleteBoardDocument,
  hardDeleteBoardDocument,
  clearBoardStore,
  saveBoardExport,
  listBoardExports
} from "@/lib/creator/board/board-store";
import type { BoardDocument, BoardExport } from "@/lib/creator/board/types";
import "fake-indexeddb/auto";

describe("board-store", () => {
  beforeEach(async () => {
    await clearBoardStore();
  });

  const sampleDoc: BoardDocument = {
    id: "board_1",
    projectId: "proj_1",
    sessionId: "sess_1",
    title: "Test Board",
    width: 1024,
    height: 1024,
    background: { type: "solid", color: "#ffffff" },
    layers: [],
    activeLayerId: null,
    schemaVersion: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    deletedAt: null
  };

  const sampleDoc2: BoardDocument = {
    ...sampleDoc,
    id: "board_2",
    updatedAt: "2024-01-02T00:00:00.000Z"
  };

  it("creates, reads, and lists board documents", async () => {
    await saveBoardDocument(sampleDoc);
    await saveBoardDocument(sampleDoc2);

    const doc = await getBoardDocument("board_1");
    expect(doc).toEqual(sampleDoc);

    const list = await listBoardDocuments("sess_1");
    expect(list).toHaveLength(2);
    // Should be sorted by updatedAt descending
    expect(list[0]).toEqual(sampleDoc2);
    expect(list[1]).toEqual(sampleDoc);
  });

  it("updates existing board document", async () => {
    await saveBoardDocument(sampleDoc);

    const updated = { ...sampleDoc, title: "Updated Title" };
    await saveBoardDocument(updated);

    const doc = await getBoardDocument("board_1");
    expect(doc?.title).toBe("Updated Title");
  });

  it("soft deletes a board document", async () => {
    await saveBoardDocument(sampleDoc);
    await softDeleteBoardDocument("board_1");

    const doc = await getBoardDocument("board_1");
    expect(doc?.deletedAt).not.toBeNull();
    expect(doc?.updatedAt).toBe(doc?.deletedAt);
  });

  it("hard deletes a board document", async () => {
    await saveBoardDocument(sampleDoc);
    await hardDeleteBoardDocument("board_1");

    const doc = await getBoardDocument("board_1");
    expect(doc).toBeNull();
  });

  it("saves and lists board exports", async () => {
    const boardExport: BoardExport = {
      id: "export_1",
      boardDocumentId: "board_1",
      projectId: "proj_1",
      sessionId: "sess_1",
      kind: "reference_png",
      assetId: "asset_1",
      width: 1024,
      height: 1024,
      pixelRatio: 1,
      createdAt: "2024-01-01T00:00:00.000Z"
    };

    await saveBoardExport(boardExport);
    
    const list = await listBoardExports("board_1");
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(boardExport);
  });
});
