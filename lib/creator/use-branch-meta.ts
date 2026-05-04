"use client";

/**
 * Branch 元数据 React hook —— 把 branch-meta-store 暴露成 sidebar 友好的
 * Map 加 4 个语义化 callbacks。
 *
 * 数据流：
 *   IndexedDB (psypic_branch_meta)
 *     └─ listBranchMeta() ─→ Map<branchId, StoredBranchMeta>
 *         └─ useBranchMeta() hook
 *             └─ ProjectSidebar / CreatorWorkspace
 *
 * 4 个语义 callback：setPinned / setLabel / setArchived / markRead；都
 * optimistic 更新内存 Map + 后台 patch 落库。落库失败不回滚（IndexedDB
 * 不可用时 patch 直接 no-op，符合"hook fallback to in-memory only"）。
 *
 * SSR safe：window/indexedDB 缺时直接返回空 Map + no-op callbacks。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  listBranchMeta,
  patchBranchMeta,
  type StoredBranchMeta
} from "@/lib/creator/branch-meta-store";

export type BranchMetaMap = ReadonlyMap<string, StoredBranchMeta>;

export type UseBranchMetaReturn = {
  metaById: BranchMetaMap;
  isLoading: boolean;
  setPinned: (branchId: string, isPinned: boolean) => Promise<void>;
  setLabel: (branchId: string, label: string) => Promise<void>;
  setArchived: (branchId: string, isArchived: boolean) => Promise<void>;
  /** 标记已读：写入 lastReadAt = now。 */
  markRead: (branchId: string) => Promise<void>;
  /** 标记未读：清除 lastReadAt。语义对应菜单「标记为未读」。 */
  markUnread: (branchId: string) => Promise<void>;
};

export function useBranchMeta(): UseBranchMetaReturn {
  const [metaById, setMetaById] = useState<Map<string, StoredBranchMeta>>(
    () => new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    (async () => {
      const items = await listBranchMeta();
      if (!isMountedRef.current) {
        return;
      }
      setMetaById(new Map(items.map((item) => [item.branchId, item])));
      setIsLoading(false);
    })();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyPatch = useCallback(
    async (
      branchId: string,
      patch: Partial<Omit<StoredBranchMeta, "branchId" | "updatedAt">>
    ): Promise<void> => {
      const next = await patchBranchMeta(branchId, patch);
      if (!isMountedRef.current) {
        return;
      }
      setMetaById((prev) => {
        const map = new Map(prev);
        if (next) {
          map.set(branchId, next);
        } else {
          // IndexedDB 不可用 fallback：仍维持内存 patch（重命名等本会话内能 work）
          const existing = map.get(branchId) ?? {
            branchId,
            updatedAt: new Date().toISOString()
          };
          map.set(branchId, { ...existing, ...patch, branchId });
        }
        return map;
      });
    },
    []
  );

  const setPinned = useCallback(
    (branchId: string, isPinned: boolean) =>
      applyPatch(branchId, { isPinned }),
    [applyPatch]
  );

  const setLabel = useCallback(
    (branchId: string, label: string) => {
      const trimmed = label.trim();
      return applyPatch(branchId, {
        customLabel: trimmed.length > 0 ? trimmed : undefined
      });
    },
    [applyPatch]
  );

  const setArchived = useCallback(
    (branchId: string, isArchived: boolean) =>
      applyPatch(branchId, { isArchived }),
    [applyPatch]
  );

  const markRead = useCallback(
    (branchId: string) =>
      applyPatch(branchId, { lastReadAt: new Date().toISOString() }),
    [applyPatch]
  );

  const markUnread = useCallback(
    (branchId: string) => applyPatch(branchId, { lastReadAt: undefined }),
    [applyPatch]
  );

  return useMemo(
    () => ({
      metaById,
      isLoading,
      setPinned,
      setLabel,
      setArchived,
      markRead,
      markUnread
    }),
    [metaById, isLoading, setPinned, setLabel, setArchived, markRead, markUnread]
  );
}
