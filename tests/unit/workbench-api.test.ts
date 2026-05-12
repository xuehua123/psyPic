import { describe, expect, it, vi, beforeEach } from "vitest";
import * as workbenchApi from "@/lib/creator/workbench-api";
import { listProjects, pullWorkbenchChanges } from "@/lib/creator/workbench-api";

const mockFetchApi = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client/api-result", () => ({
  fetchApi: mockFetchApi
}));

describe("workbench-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls listProjects with correct url", async () => {
    mockFetchApi.mockResolvedValue({ success: true, data: { items: [], next_cursor: null } });
    await listProjects("cur123", 10);
    expect(mockFetchApi).toHaveBeenCalledWith("/api/workbench/projects?cursor=cur123&limit=10");
  });

  it("calls pullWorkbenchChanges with correct url", async () => {
    mockFetchApi.mockResolvedValue({ success: true, data: {} });
    await pullWorkbenchChanges("2024-01-01T00:00:00Z");
    expect(mockFetchApi).toHaveBeenCalledWith("/api/workbench/sync?updated_since=2024-01-01T00%3A00%3A00Z");
  });

  it("propagates 503 retryAfter", async () => {
    mockFetchApi.mockResolvedValue({
      success: false,
      error: { code: "workbench_store_unavailable", message: "unavailable" },
      retryAfter: "30"
    });

    const result = await listProjects();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("workbench_store_unavailable");
      expect(result.retryAfter).toBe("30");
    }
  });

  it("does not export deleteVersionNode (backend only supports GET/PATCH)", () => {
    // 后端 /api/workbench/version-nodes/[nodeId] 只暴露 GET/PATCH，
    // 前端不应该暴露 deleteVersionNode，删除必须走 sync push。
    expect("deleteVersionNode" in workbenchApi).toBe(false);
  });

  it("calls listJobRuntimeEvents with correct url parameters", async () => {
    mockFetchApi.mockResolvedValue({ success: true, data: { items: [], next_cursor: null } });
    await workbenchApi.listJobRuntimeEvents("task_1", undefined, "cur_x", 15);
    expect(mockFetchApi).toHaveBeenCalledWith("/api/workbench/job-runtime-events?task_id=task_1&cursor=cur_x&limit=15");

    await workbenchApi.listJobRuntimeEvents(undefined, "node_1", undefined, 50);
    expect(mockFetchApi).toHaveBeenCalledWith("/api/workbench/job-runtime-events?version_node_id=node_1&limit=50");
  });
});
