import { describe, expect, it } from "vitest";
import {
  mapWorkbenchProjectToStoredProject,
  mapWorkbenchVersionNodeToCreatorNode
} from "@/lib/creator/workbench-mappers";

describe("workbench-mappers", () => {
  it("maps WorkbenchProject to StoredProject", () => {
    const proj = {
      id: "proj_1",
      user_id: "user_1",
      title: "Test",
      sort_order: 1,
      collapsed: false,
      active_session_id: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      deleted_at: null
    };

    const stored = mapWorkbenchProjectToStoredProject(proj);
    expect(stored.id).toBe("proj_1");
    expect(stored.title).toBe("Test");
    expect(stored.isBuiltin).toBe(false);
    expect(stored.sortOrder).toBe(1);
  });

  it("maps WorkbenchVersionNode to StoredWorkbenchVersionNode retaining board fields", () => {
    const node = {
      id: "node_1",
      project_id: "proj_1",
      session_id: "sess_1",
      parent_version_node_id: null,
      prompt_snapshot: "test prompt",
      params_snapshot: {},
      source_asset_ids: [],
      output_asset_ids: ["asset_1"],
      board_document_id: "doc_1",
      board_snapshot: { foo: "bar" },
      board_export_asset_id: "export_1",
      branch_label: "branch A",
      status: "succeeded" as const,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      deleted_at: null
    };

    const creatorNode = mapWorkbenchVersionNodeToCreatorNode(node, 1, "branch_id_1");
    
    expect(creatorNode.id).toBe("node_1");
    expect(creatorNode.prompt).toBe("test prompt");
    expect(creatorNode.images[0].asset_id).toBe("asset_1");
    expect(creatorNode.boardDocumentId).toBe("doc_1");
    expect(creatorNode.boardSnapshot).toEqual({ foo: "bar" });
    expect(creatorNode.boardExportAssetId).toBe("export_1");
    expect(creatorNode.depth).toBe(1);
    expect(creatorNode.branchId).toBe("branch_id_1");
  });
});
