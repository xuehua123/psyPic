import { describe, expect, it, vi, beforeEach } from "vitest";
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
});
