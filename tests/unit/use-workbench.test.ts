import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkbench } from "@/lib/creator/use-workbench";

// 模拟 workbench-api
const mockListProjects = vi.hoisted(() => vi.fn());
const mockCreateProject = vi.hoisted(() => vi.fn());
const mockUpdateProject = vi.hoisted(() => vi.fn());
const mockDeleteProject = vi.hoisted(() => vi.fn());
const mockPushWorkbenchChanges = vi.hoisted(() => vi.fn());
const mockPullWorkbenchChanges = vi.hoisted(() => vi.fn());

vi.mock("@/lib/creator/workbench-api", () => ({
  listProjects: mockListProjects,
  createProject: mockCreateProject,
  updateProject: mockUpdateProject,
  deleteProject: mockDeleteProject,
  pushWorkbenchChanges: mockPushWorkbenchChanges,
  pullWorkbenchChanges: mockPullWorkbenchChanges
}));

// 模拟 workbench-cache-store（jsdom 无真实 IndexedDB）
const mockSaveCachedProject = vi.hoisted(() => vi.fn());
const mockDeleteCachedProject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/creator/workbench-cache-store", () => ({
  listCachedProjects: vi.fn().mockResolvedValue([]),
  saveCachedProject: mockSaveCachedProject,
  deleteCachedProject: mockDeleteCachedProject,
  deleteCachedSession: vi.fn().mockResolvedValue(undefined),
  deleteCachedVersionNode: vi.fn().mockResolvedValue(undefined)
}));

// 模拟 workbench-outbox-store
const mockAddOutboxOperation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/creator/workbench-outbox-store", () => ({
  listOutboxOperations: vi.fn().mockResolvedValue([]),
  addOutboxOperation: mockAddOutboxOperation,
  removeOutboxOperations: vi.fn().mockResolvedValue(undefined)
}));

const SERVER_PROJECT = {
  id: "proj_server_1",
  user_id: "u1",
  title: "Server Project",
  sort_order: 0,
  collapsed: false,
  active_session_id: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  deleted_at: null
};

describe("useWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveCachedProject.mockResolvedValue(undefined);
    mockDeleteCachedProject.mockResolvedValue(undefined);
  });

  it("enters server mode when listProjects succeeds", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });

    const { result } = renderHook(() => useWorkbench());

    await waitFor(() => expect(result.current.mode).toBe("server"));
    expect(result.current.serverProjects).toHaveLength(1);
    expect(result.current.serverProjects[0].title).toBe("Server Project");
    expect(result.current.retryAfter).toBeUndefined();
  });

  it("enters fallback mode on 503 with retryAfter preserved", async () => {
    mockListProjects.mockResolvedValue({
      success: false,
      error: { code: "workbench_store_unavailable", message: "unavailable" },
      retryAfter: "30"
    });

    const { result } = renderHook(() => useWorkbench());

    await waitFor(() => expect(result.current.mode).toBe("fallback"));
    expect(result.current.retryAfter).toBe("30");
    expect(result.current.serverProjects).toHaveLength(0);
  });

  it("enters fallback mode on network_error", async () => {
    mockListProjects.mockResolvedValue({
      success: false,
      error: { code: "network_error", message: "网络错误" }
    });

    const { result } = renderHook(() => useWorkbench());

    await waitFor(() => expect(result.current.mode).toBe("fallback"));
  });

  it("enters auth_error mode on 401 and does NOT treat it as fallback", async () => {
    mockListProjects.mockResolvedValue({
      success: false,
      error: { code: "unauthorized", message: "请先登录" }
    });

    const { result } = renderHook(() => useWorkbench());

    await waitFor(() => expect(result.current.mode).toBe("auth_error"));
    // 关键：auth_error 不是 fallback，retryAfter 为 undefined
    expect(result.current.retryAfter).toBeUndefined();
  });

  it("enters auth_error mode on 403", async () => {
    mockListProjects.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "无权限" }
    });

    const { result } = renderHook(() => useWorkbench());

    await waitFor(() => expect(result.current.mode).toBe("auth_error"));
  });

  it("createProject returns server project and refreshes on success", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });

    const newProject = { ...SERVER_PROJECT, id: "proj_new_1", title: "New" };
    mockCreateProject.mockResolvedValue({
      success: true,
      data: newProject,
      requestId: "req_2"
    });

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.mode).toBe("server"));

    // 第二次 listProjects 返回包含新项目
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT, newProject], next_cursor: null },
      requestId: "req_3"
    });

    let created: Awaited<ReturnType<typeof result.current.createProject>> = null;
    await act(async () => {
      created = await result.current.createProject("New");
    });

    expect(created).not.toBeNull();
    expect(created!.title).toBe("New");
    expect(mockCreateProject).toHaveBeenCalledWith({ title: "New" });
  });

  it("renameProject calls updateProject and refreshes", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });
    mockUpdateProject.mockResolvedValue({
      success: true,
      data: { ...SERVER_PROJECT, title: "Renamed" },
      requestId: "req_2"
    });

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.mode).toBe("server"));

    let success = false;
    await act(async () => {
      success = await result.current.renameProject("proj_server_1", "Renamed");
    });

    expect(success).toBe(true);
    expect(mockUpdateProject).toHaveBeenCalledWith("proj_server_1", { title: "Renamed" });
  });

  it("deleteProject calls API and refreshes", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });
    mockDeleteProject.mockResolvedValue({
      success: true,
      data: { ...SERVER_PROJECT, deleted_at: "2024-01-01T00:00:00Z" },
      requestId: "req_2"
    });

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.mode).toBe("server"));

    // 删除后 listProjects 返回空
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [], next_cursor: null },
      requestId: "req_3"
    });

    let success = false;
    await act(async () => {
      success = await result.current.deleteProject("proj_server_1");
    });

    expect(success).toBe(true);
    expect(mockDeleteProject).toHaveBeenCalledWith("proj_server_1");
  });

  it("exposes initial syncState as synced", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.mode).toBe("server"));

    expect(result.current.syncState.status).toBe("synced");
    expect(result.current.syncState.pendingCount).toBe(0);
    expect(result.current.syncState.conflicts).toHaveLength(0);
  });

  it("provides flushSync and dismissSyncConflict methods", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.mode).toBe("server"));

    expect(typeof result.current.flushSync).toBe("function");
    expect(typeof result.current.dismissSyncConflict).toBe("function");
  });

  it("createProject writes to outbox on 503/network_error", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });
    mockCreateProject.mockResolvedValue({
      success: false,
      error: { code: "workbench_store_unavailable", message: "unavailable" },
      retryAfter: "30"
    });
    mockAddOutboxOperation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.mode).toBe("server"));

    let created: Awaited<ReturnType<typeof result.current.createProject>> = null;
    await act(async () => {
      created = await result.current.createProject("Offline Project");
    });

    // optimistic 返回了完整 project
    expect(created).not.toBeNull();
    expect(created!.title).toBe("Offline Project");
    // 写入了 outbox
    expect(mockAddOutboxOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "project",
        action: "upsert",
        data: expect.objectContaining({ title: "Offline Project" })
      })
    );
    // cache 写入
    expect(mockSaveCachedProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Offline Project", deleted_at: null })
    );
    // hook state 立即更新
    expect(result.current.serverProjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Offline Project" })
      ])
    );
    // syncState 更新
    expect(result.current.syncState.status).toBe("offline");
    expect(result.current.syncState.pendingCount).toBe(1);
  });

  it("renameProject writes to outbox on 503", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });
    mockUpdateProject.mockResolvedValue({
      success: false,
      error: { code: "network_error", message: "网络错误" }
    });
    mockAddOutboxOperation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.mode).toBe("server"));

    let success = false;
    await act(async () => {
      success = await result.current.renameProject("proj_server_1", "Renamed Offline");
    });

    expect(success).toBe(true); // optimistic
    expect(mockAddOutboxOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "project",
        action: "upsert",
        data: expect.objectContaining({ id: "proj_server_1", title: "Renamed Offline" })
      })
    );
    // cache 写入
    expect(mockSaveCachedProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "proj_server_1", title: "Renamed Offline" })
    );
    // hook state 立即更新
    const renamed = result.current.serverProjects.find((p) => p.id === "proj_server_1");
    expect(renamed?.title).toBe("Renamed Offline");
    expect(result.current.syncState.status).toBe("offline");
    expect(result.current.syncState.pendingCount).toBe(1);
  });

  it("deleteProject writes to outbox on 503", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });
    mockDeleteProject.mockResolvedValue({
      success: false,
      error: { code: "workbench_store_unavailable", message: "unavailable" },
      retryAfter: "30"
    });
    mockAddOutboxOperation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.mode).toBe("server"));

    let success = false;
    await act(async () => {
      success = await result.current.deleteProject("proj_server_1");
    });

    expect(success).toBe(true); // optimistic
    expect(mockAddOutboxOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "project",
        action: "delete",
        data: expect.objectContaining({ id: "proj_server_1" })
      })
    );
    // cache 删除
    expect(mockDeleteCachedProject).toHaveBeenCalledWith("proj_server_1");
    // hook state 立即移除
    const found = result.current.serverProjects.find((p) => p.id === "proj_server_1");
    expect(found).toBeUndefined();
    expect(result.current.syncState.status).toBe("offline");
  });

  it("createProject does NOT write to outbox on 401/403", async () => {
    mockListProjects.mockResolvedValue({
      success: true,
      data: { items: [SERVER_PROJECT], next_cursor: null },
      requestId: "req_1"
    });
    mockCreateProject.mockResolvedValue({
      success: false,
      error: { code: "unauthorized", message: "请先登录" }
    });
    mockAddOutboxOperation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.mode).toBe("server"));

    let created: Awaited<ReturnType<typeof result.current.createProject>> = null;
    await act(async () => {
      created = await result.current.createProject("Auth Fail");
    });

    expect(created).toBeNull();
    // 不写 outbox
    expect(mockAddOutboxOperation).not.toHaveBeenCalled();
    // 进入 needs_attention
    expect(result.current.syncState.status).toBe("needs_attention");
  });
});
