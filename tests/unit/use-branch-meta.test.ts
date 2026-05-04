import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useBranchMeta } from "@/lib/creator/use-branch-meta";

/**
 * jsdom 无 IndexedDB；hook 走 fallback：list 返回空，patch 写入内存 Map
 * 但不落库 —— 重新挂载会回到空。这组测试验证 in-memory 行为正确。
 */
describe("useBranchMeta (no IndexedDB fallback)", () => {
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

  it("starts with empty metaById and isLoading=false after mount", async () => {
    const { result } = renderHook(() => useBranchMeta());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.metaById.size).toBe(0);
  });

  it("setPinned writes isPinned into the in-memory map", async () => {
    const { result } = renderHook(() => useBranchMeta());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPinned("br_1", true);
    });

    const meta = result.current.metaById.get("br_1");
    expect(meta?.isPinned).toBe(true);
  });

  it("setLabel trims and stores customLabel; empty label clears it", async () => {
    const { result } = renderHook(() => useBranchMeta());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setLabel("br_2", "  我的会话  ");
    });
    expect(result.current.metaById.get("br_2")?.customLabel).toBe("我的会话");

    await act(async () => {
      await result.current.setLabel("br_2", "");
    });
    expect(result.current.metaById.get("br_2")?.customLabel).toBeUndefined();
  });

  it("setArchived toggles the flag", async () => {
    const { result } = renderHook(() => useBranchMeta());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setArchived("br_3", true);
    });
    expect(result.current.metaById.get("br_3")?.isArchived).toBe(true);

    await act(async () => {
      await result.current.setArchived("br_3", false);
    });
    expect(result.current.metaById.get("br_3")?.isArchived).toBe(false);
  });

  it("markRead sets lastReadAt to a parseable ISO; markUnread clears it", async () => {
    const { result } = renderHook(() => useBranchMeta());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markRead("br_4");
    });
    const readAt = result.current.metaById.get("br_4")?.lastReadAt;
    expect(typeof readAt).toBe("string");
    expect(Number.isFinite(Date.parse(readAt!))).toBe(true);

    await act(async () => {
      await result.current.markUnread("br_4");
    });
    expect(result.current.metaById.get("br_4")?.lastReadAt).toBeUndefined();
  });

  it("multiple branches are tracked independently", async () => {
    const { result } = renderHook(() => useBranchMeta());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setPinned("br_a", true);
      await result.current.setLabel("br_b", "Beta");
      await result.current.setArchived("br_c", true);
    });

    expect(result.current.metaById.get("br_a")?.isPinned).toBe(true);
    expect(result.current.metaById.get("br_b")?.customLabel).toBe("Beta");
    expect(result.current.metaById.get("br_c")?.isArchived).toBe(true);
    expect(result.current.metaById.size).toBe(3);
  });
});
