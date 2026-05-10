import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultProjectSeeds } from "@/lib/creator/projects";
import { useProjects } from "@/lib/creator/use-projects";
import type { UseWorkbenchReturn } from "@/lib/creator/use-workbench";

// 可变 mock 返回值，允许在不同 describe 块中切换 mode
const mockWorkbenchReturn = vi.hoisted(() => {
  const value: UseWorkbenchReturn = {
    mode: "fallback",
    serverProjects: [],
    rawServerProjects: [],
    retryAfter: undefined,
    createProject: vi.fn().mockResolvedValue(null),
    renameProject: vi.fn().mockResolvedValue(false),
    deleteProject: vi.fn().mockResolvedValue(false),
    refresh: vi.fn().mockResolvedValue(undefined)
  };
  return { value };
});

vi.mock("@/lib/creator/use-workbench", () => ({
  useWorkbench: () => mockWorkbenchReturn.value
}));

/**
 * jsdom 不带 IndexedDB；这组测试覆盖 hook 的 **fallback 路径**：
 * IndexedDB 不可用时直接吐 defaultProjectSeeds，CRUD 变 no-op。
 */
describe("useProjects (no IndexedDB fallback)", () => {
  let originalIndexedDB: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalIndexedDB = Object.getOwnPropertyDescriptor(window, "indexedDB");
    if (originalIndexedDB) {
      // @ts-expect-error 测试里有意删
      delete window.indexedDB;
    }
    // 确保 fallback 模式
    mockWorkbenchReturn.value = {
      mode: "fallback",
      serverProjects: [],
      rawServerProjects: [],
      retryAfter: undefined,
      createProject: vi.fn().mockResolvedValue(null),
      renameProject: vi.fn().mockResolvedValue(false),
      deleteProject: vi.fn().mockResolvedValue(false),
      refresh: vi.fn().mockResolvedValue(undefined)
    };
  });

  afterEach(() => {
    if (originalIndexedDB) {
      Object.defineProperty(window, "indexedDB", originalIndexedDB);
    }
  });

  it("returns default seeds and exits loading when IndexedDB is unavailable", async () => {
    const { result } = renderHook(() => useProjects());

    expect(result.current.projects).toHaveLength(defaultProjectSeeds.length);
    expect(result.current.projects[0]?.id).toBe("commercial");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projects.map((project) => project.id)).toEqual(
      defaultProjectSeeds.map((seed) => seed.id)
    );
  });

  it("createProject returns null without IndexedDB", async () => {
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: Awaited<ReturnType<typeof result.current.createProject>> = null;
    await act(async () => {
      created = await result.current.createProject("我的项目");
    });

    expect(created).toBeNull();
    expect(result.current.projects.map((project) => project.id)).toEqual(
      defaultProjectSeeds.map((seed) => seed.id)
    );
  });

  it("renameProject is a no-op without IndexedDB", async () => {
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const originalTitle = result.current.projects[0]?.title;
    await act(async () => {
      await result.current.renameProject("commercial", "改名后的标题");
    });
    expect(result.current.projects[0]?.title).toBe(originalTitle);
  });

  it("deleteProject is a no-op without IndexedDB", async () => {
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteProject("commercial");
    });
    expect(result.current.projects.map((project) => project.id)).toContain(
      "commercial"
    );
  });

  it("returns a stable shape for the hook output", async () => {
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(typeof result.current.createProject).toBe("function");
    expect(typeof result.current.renameProject).toBe("function");
    expect(typeof result.current.deleteProject).toBe("function");
    expect(typeof result.current.refresh).toBe("function");
  });
});

/**
 * server mode 下：CRUD 只走 server，不 fallthrough 到本地 IndexedDB。
 */
describe("useProjects (server mode isolation)", () => {
  let originalIndexedDB: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalIndexedDB = Object.getOwnPropertyDescriptor(window, "indexedDB");
    if (originalIndexedDB) {
      // @ts-expect-error 测试里有意删
      delete window.indexedDB;
    }
  });

  afterEach(() => {
    if (originalIndexedDB) {
      Object.defineProperty(window, "indexedDB", originalIndexedDB);
    }
  });

  it("shows empty projects when server returns empty array", async () => {
    mockWorkbenchReturn.value = {
      mode: "server",
      serverProjects: [],
      rawServerProjects: [],
      retryAfter: undefined,
      createProject: vi.fn().mockResolvedValue(null),
      renameProject: vi.fn().mockResolvedValue(false),
      deleteProject: vi.fn().mockResolvedValue(false),
      refresh: vi.fn().mockResolvedValue(undefined)
    };

    const { result } = renderHook(() => useProjects());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 关键断言：server mode + 空数组 → 显示空列表，不是 seed/stale local
    expect(result.current.projects).toHaveLength(0);
  });

  it("createProject returns null and does NOT create local project when server fails", async () => {
    const mockCreate = vi.fn().mockResolvedValue(null);
    mockWorkbenchReturn.value = {
      mode: "server",
      serverProjects: [],
      rawServerProjects: [],
      retryAfter: undefined,
      createProject: mockCreate,
      renameProject: vi.fn().mockResolvedValue(false),
      deleteProject: vi.fn().mockResolvedValue(false),
      refresh: vi.fn().mockResolvedValue(undefined)
    };

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: Awaited<ReturnType<typeof result.current.createProject>> = null;
    await act(async () => {
      created = await result.current.createProject("Server Fail Project");
    });

    // server 失败 → 返回 null
    expect(created).toBeNull();
    expect(mockCreate).toHaveBeenCalledWith("Server Fail Project");
    // 关键：不应创建本地项目——projects 仍然是 server 的空数组
    expect(result.current.projects).toHaveLength(0);
  });

  it("renameProject does NOT modify local projects when server fails", async () => {
    const mockRename = vi.fn().mockResolvedValue(false);
    const serverProject = {
      id: "proj_s1" as const,
      title: "Server Title",
      description: undefined,
      isBuiltin: false,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      sortOrder: 0
    };
    mockWorkbenchReturn.value = {
      mode: "server",
      serverProjects: [serverProject],
      rawServerProjects: [],
      retryAfter: undefined,
      createProject: vi.fn().mockResolvedValue(null),
      renameProject: mockRename,
      deleteProject: vi.fn().mockResolvedValue(false),
      refresh: vi.fn().mockResolvedValue(undefined)
    };

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.renameProject("proj_s1" as never, "New Title");
    });

    // server rename 失败 → 不修改本地
    expect(mockRename).toHaveBeenCalledWith("proj_s1", "New Title");
    expect(result.current.projects[0]?.title).toBe("Server Title");
  });

  it("deleteProject does NOT delete local projects when server fails", async () => {
    const mockDelete = vi.fn().mockResolvedValue(false);
    const serverProject = {
      id: "proj_s2" as const,
      title: "Keep This",
      description: undefined,
      isBuiltin: false,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      sortOrder: 0
    };
    mockWorkbenchReturn.value = {
      mode: "server",
      serverProjects: [serverProject],
      rawServerProjects: [],
      retryAfter: undefined,
      createProject: vi.fn().mockResolvedValue(null),
      renameProject: vi.fn().mockResolvedValue(false),
      deleteProject: mockDelete,
      refresh: vi.fn().mockResolvedValue(undefined)
    };

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteProject("proj_s2" as never);
    });

    // server delete 失败 → 不删本地
    expect(mockDelete).toHaveBeenCalledWith("proj_s2");
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0]?.title).toBe("Keep This");
  });
});
