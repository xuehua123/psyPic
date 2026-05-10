import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkbench } from "@/lib/creator/use-workbench";

// 模拟 workbench-api
const mockListProjects = vi.hoisted(() => vi.fn());
const mockCreateProject = vi.hoisted(() => vi.fn());
const mockUpdateProject = vi.hoisted(() => vi.fn());
const mockDeleteProject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/creator/workbench-api", () => ({
  listProjects: mockListProjects,
  createProject: mockCreateProject,
  updateProject: mockUpdateProject,
  deleteProject: mockDeleteProject
}));

// 模拟 workbench-cache-store（jsdom 无真实 IndexedDB）
vi.mock("@/lib/creator/workbench-cache-store", () => ({
  listCachedProjects: vi.fn().mockResolvedValue([]),
  saveCachedProject: vi.fn().mockResolvedValue(undefined),
  deleteCachedProject: vi.fn().mockResolvedValue(undefined)
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
});
