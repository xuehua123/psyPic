import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deleteBranchMeta,
  getBranchMeta,
  listBranchMeta,
  patchBranchMeta
} from "@/lib/creator/branch-meta-store";

/**
 * jsdom 不带 IndexedDB；这组测试覆盖 store 的 **fallback 路径**：
 * IndexedDB 不可用时所有读写都安全 no-op（list/get 返回空 / patch 返回 null
 * / delete 不抛错）。
 *
 * 真实 IndexedDB 流程在 hook 集成 + creator-shell e2e 里覆盖。
 */
describe("branch-meta-store (no IndexedDB fallback)", () => {
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

  it("listBranchMeta returns empty array", async () => {
    expect(await listBranchMeta()).toEqual([]);
  });

  it("getBranchMeta returns null", async () => {
    expect(await getBranchMeta("br_x")).toBeNull();
  });

  it("patchBranchMeta returns null without throwing", async () => {
    expect(await patchBranchMeta("br_x", { isPinned: true })).toBeNull();
  });

  it("deleteBranchMeta does not throw", async () => {
    await expect(deleteBranchMeta("br_x")).resolves.toBeUndefined();
  });

  it("patch with multiple field types is accepted shape-wise", async () => {
    // 即便没 IndexedDB，types 不能让我们传错；这条编译过 = 类型 OK
    await patchBranchMeta("br_x", {
      customLabel: "重命名",
      isPinned: true,
      isArchived: false,
      lastReadAt: new Date().toISOString()
    });
    expect(true).toBe(true);
  });

  it("listBranchMeta is idempotent on multiple calls", async () => {
    expect(await listBranchMeta()).toEqual([]);
    expect(await listBranchMeta()).toEqual([]);
  });
});
