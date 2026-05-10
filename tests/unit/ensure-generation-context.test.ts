import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureGenerationContext,
  type EnsureContextInput
} from "@/lib/creator/ensure-generation-context";

const mockCreateSession = vi.hoisted(() => vi.fn());
const mockUpdateProject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/creator/workbench-api", () => ({
  createSession: mockCreateSession,
  updateProject: mockUpdateProject
}));

function makeInput(
  overrides?: Partial<EnsureContextInput>
): EnsureContextInput {
  return {
    mode: "server",
    rawServerProjects: [
      {
        id: "proj_1",
        user_id: "user_1",
        title: "Test Project",
        sort_order: 0,
        collapsed: false,
        active_session_id: "sess_1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        deleted_at: null
      }
    ],
    activeProjectId: "proj_1",
    candidateParentNodeId: null,
    serverNodeIds: new Set<string>(),
    refreshWorkbench: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("ensureGenerationContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null in fallback mode", async () => {
    const result = await ensureGenerationContext(makeInput({ mode: "fallback" }));
    expect(result).toBeNull();
  });

  it("returns context with existing active_session_id", async () => {
    const result = await ensureGenerationContext(makeInput());

    expect(result).toEqual({
      projectId: "proj_1",
      sessionId: "sess_1",
      parentVersionNodeId: null
    });
    // 不应创建 session
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("creates session when active_session_id is null", async () => {
    const refreshWorkbench = vi.fn().mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue({
      success: true,
      data: { id: "sess_new", project_id: "proj_1", title: "默认会话" }
    });
    mockUpdateProject.mockResolvedValue({
      success: true,
      data: { id: "proj_1" }
    });

    const result = await ensureGenerationContext(
      makeInput({
        rawServerProjects: [
          {
            id: "proj_1",
            user_id: "user_1",
            title: "Test",
            sort_order: 0,
            collapsed: false,
            active_session_id: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            deleted_at: null
          }
        ],
        refreshWorkbench
      })
    );

    expect(mockCreateSession).toHaveBeenCalledWith({
      project_id: "proj_1",
      title: "默认会话"
    });
    expect(mockUpdateProject).toHaveBeenCalledWith("proj_1", {
      active_session_id: "sess_new"
    });
    expect(refreshWorkbench).toHaveBeenCalled();
    expect(result).toEqual({
      projectId: "proj_1",
      sessionId: "sess_new",
      parentVersionNodeId: null
    });
  });

  it("returns null when session creation fails", async () => {
    mockCreateSession.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "no access" }
    });

    const result = await ensureGenerationContext(
      makeInput({
        rawServerProjects: [
          {
            id: "proj_1",
            user_id: "user_1",
            title: "Test",
            sort_order: 0,
            collapsed: false,
            active_session_id: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            deleted_at: null
          }
        ]
      })
    );

    expect(result).toBeNull();
  });

  it("includes parentVersionNodeId when candidate is in server node set", async () => {
    const result = await ensureGenerationContext(
      makeInput({
        candidateParentNodeId: "vn_server_123",
        serverNodeIds: new Set(["vn_server_123", "vn_server_456"])
      })
    );

    expect(result?.parentVersionNodeId).toBe("vn_server_123");
  });

  it("drops parentVersionNodeId when candidate is a local node_* id NOT in server set", async () => {
    const result = await ensureGenerationContext(
      makeInput({
        candidateParentNodeId: "node_task_local_456",
        serverNodeIds: new Set(["vn_server_123"])
      })
    );

    expect(result?.parentVersionNodeId).toBeNull();
  });

  it("returns null when activeProjectId is not found in rawServerProjects", async () => {
    const result = await ensureGenerationContext(
      makeInput({ activeProjectId: "proj_nonexistent" })
    );

    expect(result).toBeNull();
  });

  it("returns null when activeProjectId is still 'commercial' (not yet aligned to server project)", async () => {
    // 模拟 server projects 已加载但 activeProjectId 仍是初始值 "commercial"
    const result = await ensureGenerationContext(
      makeInput({ activeProjectId: "commercial" })
    );

    expect(result).toBeNull();
    // 说明 generation context 不应因为 activeProjectId 不匹配而意外发送
  });

  it("created sessionId is usable for immediate refreshForSession call", async () => {
    // 验证 ensureGenerationContext 返回的 sessionId 可以直接传给 refreshForSession
    mockCreateSession.mockResolvedValue({
      success: true,
      data: { id: "sess_brand_new", project_id: "proj_1", title: "默认会话" }
    });
    mockUpdateProject.mockResolvedValue({
      success: true,
      data: { id: "proj_1" }
    });

    const result = await ensureGenerationContext(
      makeInput({
        rawServerProjects: [
          {
            id: "proj_1",
            user_id: "user_1",
            title: "Test",
            sort_order: 0,
            collapsed: false,
            active_session_id: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            deleted_at: null
          }
        ]
      })
    );

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe("sess_brand_new");
    // 调用方可以直接用 result.sessionId 传给 refreshForSession
  });

  it("multi-project: context only matches the specified activeProjectId", async () => {
    const multiProjectInput = makeInput({
      rawServerProjects: [
        {
          id: "proj_A",
          user_id: "user_1",
          title: "Project A",
          sort_order: 0,
          collapsed: false,
          active_session_id: "sess_A",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          deleted_at: null
        },
        {
          id: "proj_B",
          user_id: "user_1",
          title: "Project B",
          sort_order: 1,
          collapsed: false,
          active_session_id: "sess_B",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          deleted_at: null
        }
      ],
      activeProjectId: "proj_A"
    });

    const result = await ensureGenerationContext(multiProjectInput);

    // 应该返回 proj_A 的 sessionId，不是 proj_B 的
    expect(result).toEqual({
      projectId: "proj_A",
      sessionId: "sess_A",
      parentVersionNodeId: null
    });
  });
});
