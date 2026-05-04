import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultProjectSeeds } from "@/lib/creator/projects";
import { useProjects } from "@/lib/creator/use-projects";

/**
 * jsdom 不带 IndexedDB；这组测试覆盖 hook 的 **fallback 路径**：
 * IndexedDB 不可用时直接吐 defaultProjectSeeds，CRUD 变 no-op。
 *
 * 真实 IndexedDB 流程在 Cut 5 component 测试（project-sidebar-crud）里
 * 通过 UI 端到端覆盖。
 */
describe("useProjects (no IndexedDB fallback)", () => {
  // 确保 window.indexedDB 是 undefined（jsdom 默认就是，但避免之前测试
  // 用 Object.defineProperty stub 后污染状态）
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
    // projects 数组没有变化
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
