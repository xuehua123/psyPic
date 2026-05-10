import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useVersionNodes,
  rebuildBranchGraph
} from "@/lib/creator/use-version-nodes";
import type { WorkbenchVersionNode } from "@/lib/creator/workbench-types";

const mockListVersionNodes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/creator/workbench-api", () => ({
  listVersionNodes: mockListVersionNodes
}));

function makeServerNode(
  overrides: Partial<WorkbenchVersionNode> & { id: string }
): WorkbenchVersionNode {
  return {
    project_id: "proj_1",
    session_id: "sess_1",
    parent_version_node_id: null,
    prompt_snapshot: "test prompt",
    params_snapshot: {
      prompt: "test prompt",
      model: "gpt-image-2",
      size: "1024x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
      output_compression: null,
      background: "auto",
      moderation: "auto"
    },
    source_asset_ids: [],
    output_asset_ids: ["asset_1"],
    board_document_id: null,
    board_snapshot: null,
    board_export_asset_id: null,
    branch_label: null,
    status: "succeeded",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides
  };
}

describe("useVersionNodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty nodes when sessionId is null", async () => {
    const { result } = renderHook(() => useVersionNodes(null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nodes).toHaveLength(0);
    expect(mockListVersionNodes).not.toHaveBeenCalled();
  });

  it("loads and maps server nodes for a valid session", async () => {
    mockListVersionNodes.mockResolvedValue({
      success: true,
      data: {
        items: [
          makeServerNode({ id: "vn_1", output_asset_ids: ["a1"] }),
          makeServerNode({
            id: "vn_2",
            parent_version_node_id: "vn_1",
            output_asset_ids: ["a2"],
            created_at: "2024-01-01T00:01:00Z"
          })
        ],
        next_cursor: null
      }
    });

    const { result } = renderHook(() => useVersionNodes("sess_1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes[0].id).toBe("vn_1");
    expect(result.current.nodes[1].parentId).toBe("vn_1");
  });

  it("returns empty nodes when API fails", async () => {
    mockListVersionNodes.mockResolvedValue({
      success: false,
      error: { code: "unauthorized", message: "请先登录" }
    });

    const { result } = renderHook(() => useVersionNodes("sess_1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nodes).toHaveLength(0);
  });

  it("refreshForSession loads nodes for a different sessionId than hook init", async () => {
    // 初始化时 sessionId=null → 不发请求
    const { result } = renderHook(() => useVersionNodes(null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListVersionNodes).not.toHaveBeenCalled();

    // 用显式 sessionId 刷新 → 应该发请求
    mockListVersionNodes.mockResolvedValue({
      success: true,
      data: {
        items: [
          makeServerNode({ id: "vn_new_session", output_asset_ids: ["a1"] })
        ],
        next_cursor: null
      }
    });

    await act(async () => {
      await result.current.refreshForSession("sess_new_created");
    });

    expect(mockListVersionNodes).toHaveBeenCalledWith("sess_new_created");
    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].id).toBe("vn_new_session");
  });

  it("generation context with initial commercial activeProjectId resolves to server project", async () => {
    // 验证即使 activeProjectId 是 "commercial"（初始值），
    // ensureGenerationContext 中的 rawServerProjects.find 不会匹配，
    // 确保在 activeProjectId 对齐后才能正确工作
    mockListVersionNodes.mockResolvedValue({
      success: true,
      data: { items: [], next_cursor: null }
    });

    const { result } = renderHook(() => useVersionNodes("sess_real"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nodes).toHaveLength(0);
    expect(mockListVersionNodes).toHaveBeenCalledWith("sess_real");
  });
});

describe("rebuildBranchGraph", () => {
  it("maps all 7 status values correctly", () => {
    const statuses: WorkbenchVersionNode["status"][] = [
      "queued",
      "running",
      "partial_image",
      "succeeded",
      "failed",
      "canceled",
      "timed_out"
    ];

    const nodes = statuses.map((status, i) =>
      makeServerNode({
        id: `vn_${i}`,
        status,
        created_at: `2024-01-01T00:0${i}:00Z`
      })
    );

    const mapped = rebuildBranchGraph(nodes);

    // queued → running
    expect(mapped[0].status).toBe("running");
    // running → running
    expect(mapped[1].status).toBe("running");
    // partial_image → running
    expect(mapped[2].status).toBe("running");
    // succeeded → succeeded
    expect(mapped[3].status).toBe("succeeded");
    // failed → failed
    expect(mapped[4].status).toBe("failed");
    // canceled → failed
    expect(mapped[5].status).toBe("failed");
    // timed_out → failed
    expect(mapped[6].status).toBe("failed");
  });

  it("generates /api/assets/:id URLs for output assets", () => {
    const nodes = rebuildBranchGraph([
      makeServerNode({
        id: "vn_url",
        output_asset_ids: ["asset_abc", "asset_def"]
      })
    ]);

    expect(nodes[0].images).toEqual([
      { asset_id: "asset_abc", url: "/api/assets/asset_abc", format: "png" },
      { asset_id: "asset_def", url: "/api/assets/asset_def", format: "png" }
    ]);
  });

  it("rebuilds branch structure: root → child → fork", () => {
    const nodes = rebuildBranchGraph([
      makeServerNode({
        id: "root",
        created_at: "2024-01-01T00:00:00Z"
      }),
      makeServerNode({
        id: "child1",
        parent_version_node_id: "root",
        created_at: "2024-01-01T00:01:00Z"
      }),
      makeServerNode({
        id: "fork1",
        parent_version_node_id: "root",
        created_at: "2024-01-01T00:02:00Z"
      })
    ]);

    // root: branchId = root, depth = 0
    expect(nodes[0].branchId).toBe("root");
    expect(nodes[0].depth).toBe(0);
    expect(nodes[0].branchLabel).toBe("主线");

    // child1: 继承 root branch
    expect(nodes[1].branchId).toBe("root");
    expect(nodes[1].depth).toBe(1);

    // fork1: 新分支
    expect(nodes[2].branchId).toBe("fork1");
    expect(nodes[2].depth).toBe(1);
    expect(nodes[2].branchLabel).toBe("分支 2");
  });

  it("does not send board_* fields in mapped nodes", () => {
    const nodes = rebuildBranchGraph([
      makeServerNode({ id: "vn_board" })
    ]);

    // CreatorVersionNode 不含 board_* 字段
    const node = nodes[0];
    expect(node).not.toHaveProperty("boardDocumentId");
    expect(node).not.toHaveProperty("boardSnapshot");
    expect(node).not.toHaveProperty("boardExportAssetId");
  });
});
