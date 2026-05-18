import { describe, expect, it, beforeEach } from "vitest";
import {
  saveBoardDocument,
  getBoardDocument,
  listBoardDocuments,
  deleteBoardDocument,
  clearBoardStore
} from "@/lib/creator/board/board-store";
import type { BoardDocument } from "@/lib/creator/board/types";
import "fake-indexeddb/auto";

describe("board-store", () => {
  beforeEach(async () => {
    await clearBoardStore();
  });

  const createDummyDoc = (
    id: string,
    sessionId: string,
    updatedAt = "2026-05-18T00:00:00.000Z"
  ): BoardDocument => ({
    id,
    version: 1,
    projectId: "proj_1",
    sessionId,
    title: "Test Board",
    width: 1024,
    height: 1024,
    background: { type: "transparent" },
    layers: [],
    activeLayerId: null,
    sourceVersionNodeIds: [],
    sourceAssetIds: [],
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt,
    deletedAt: null,
  });

  it("saves, gets, and lists board documents", async () => {
    const doc1 = createDummyDoc("board_1", "sess_1", "2026-05-18T00:00:00.000Z");
    const doc2 = createDummyDoc("board_2", "sess_1", "2026-05-18T00:01:00.000Z");
    const doc3 = createDummyDoc("board_3", "sess_2");

    await saveBoardDocument(doc1);
    await saveBoardDocument(doc2);
    await saveBoardDocument(doc3);

    const fetchedDoc = await getBoardDocument("board_1");
    expect(fetchedDoc).toEqual(doc1);

    const list1 = await listBoardDocuments("sess_1");
    expect(list1).toHaveLength(2);
    expect(list1.map(d => d.id)).toEqual(["board_2", "board_1"]);

    const list2 = await listBoardDocuments("sess_2");
    expect(list2).toHaveLength(1);
    expect(list2[0].id).toEqual("board_3");
  });

  it("supports soft delete", async () => {
    const doc = createDummyDoc("board_to_delete", "sess_1");
    await saveBoardDocument(doc);

    let fetched = await getBoardDocument("board_to_delete");
    expect(fetched).toBeDefined();

    await deleteBoardDocument("board_to_delete", true);

    fetched = await getBoardDocument("board_to_delete");
    expect(fetched).toBeNull(); // should be filtered out

    const list = await listBoardDocuments("sess_1");
    expect(list).toHaveLength(0);
  });

  it("supports hard delete", async () => {
    const doc = createDummyDoc("board_to_hard_delete", "sess_1");
    await saveBoardDocument(doc);

    await deleteBoardDocument("board_to_hard_delete", false);

    const fetched = await getBoardDocument("board_to_hard_delete");
    expect(fetched).toBeNull();
  });
});
