"use client";

/**
 * 创作台项目 CRUD 的 React hook 层。
 *
 * 数据流（server-first + local fallback）：
 *   1. 先走 useWorkbench 尝试 server；成功则项目来自 server。
 *   2. Server 不可用（503 / network_error）时，fallback 到 IndexedDB
 *      （psypic_projects store），与原有行为完全一致。
 *   3. 401/403 → auth_error 模式，仍显示本地数据（不阻断工作台）。
 *
 * 外部签名保持稳定：UseProjectsReturn 不变，CreatorWorkspace 不需要大重构。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { defaultProjectSeeds, type CreatorProjectMeta } from "@/lib/creator/projects";
import {
  createUserProjectId,
  deleteProject as deleteStoredProject,
  listProjects,
  renameProject as renameStoredProject,
  saveProject,
  seedDefaultProjectsIfEmpty,
  type StoredProject
} from "@/lib/creator/projects-store";
import type { CreatorProjectId } from "@/lib/creator/types";
import { useWorkbench } from "@/lib/creator/use-workbench";

const FALLBACK_EMPTY_TITLE = "新项目对话";
const FALLBACK_EMPTY_DESCRIPTION = "从这里开始一条新的版本对话。";

/** seed map 用于在 toMeta 时给内置项目带回 emptyTitle / emptyDescription
 *  文案（StoredProject schema 不存这两个字段，只存 title / description）。 */
const seedMetaById = new Map<CreatorProjectId, CreatorProjectMeta>(
  defaultProjectSeeds.map((seed) => [seed.id, seed])
);

function toMeta(stored: StoredProject): CreatorProjectMeta {
  const seedMeta = seedMetaById.get(stored.id);
  return {
    id: stored.id,
    title: stored.title,
    description: stored.description ?? seedMeta?.description ?? "",
    emptyTitle: seedMeta?.emptyTitle ?? FALLBACK_EMPTY_TITLE,
    emptyDescription: seedMeta?.emptyDescription ?? FALLBACK_EMPTY_DESCRIPTION
  };
}

function canUseIndexedDB() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

export type UseProjectsReturn = {
  projects: CreatorProjectMeta[];
  isLoading: boolean;
  /** 用户新建一个项目（IndexedDB 不可用时返回 null）。 */
  createProject: (title: string) => Promise<CreatorProjectMeta | null>;
  /** 重命名（IndexedDB 不可用时 no-op）。 */
  renameProject: (id: CreatorProjectId, title: string) => Promise<void>;
  /** 删除（IndexedDB 不可用时 no-op）。 */
  deleteProject: (id: CreatorProjectId) => Promise<void>;
  /** 强制刷新；CRUD 后 hook 会自动调，外部一般不用。 */
  refresh: () => Promise<void>;
};

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<CreatorProjectMeta[]>(() =>
    // SSR / 首次渲染：先用 seeds，避免 hydration 时 sidebar 空白
    defaultProjectSeeds.map((seed) => ({ ...seed }))
  );
  const [isLoading, setIsLoading] = useState(() => canUseIndexedDB());
  /** 防止 setState on unmounted —— 卸载后 reload 完成不再写状态。 */
  const isMountedRef = useRef(true);

  const workbench = useWorkbench();

  // 本地 IndexedDB 加载（fallback 路径）
  const reloadLocal = useCallback(async () => {
    if (!canUseIndexedDB()) {
      return;
    }

    const stored = await listProjects();
    if (!isMountedRef.current) {
      return;
    }
    setProjects(stored.map(toMeta));
    setIsLoading(false);
  }, []);

  // 初始化：seed + 本地加载
  useEffect(() => {
    isMountedRef.current = true;

    (async () => {
      if (!canUseIndexedDB()) {
        return;
      }

      // 首次进入：若 store 为空写入 4 个内置 seed；非空则直接读
      await seedDefaultProjectsIfEmpty(
        defaultProjectSeeds.map((seed) => ({
          id: seed.id,
          title: seed.title,
          description: seed.description
        }))
      );
      await reloadLocal();
    })();

    return () => {
      isMountedRef.current = false;
    };
  }, [reloadLocal]);

  // server-first 项目覆盖：当 workbench mode 为 server 时，无条件用 server 项目
  // （即使是空数组也必须覆盖，避免本地 stale 数据与 server 出现 drift）
  useEffect(() => {
    if (workbench.mode === "server") {
      if (isMountedRef.current) {
        setProjects(workbench.serverProjects.map(toMeta));
        setIsLoading(false);
      }
    } else if (workbench.mode !== "loading") {
      // fallback 或 auth_error：保持本地数据（reloadLocal 已经设好了）
      if (isMountedRef.current && canUseIndexedDB()) {
        setIsLoading(false);
      }
    }
  }, [workbench.mode, workbench.serverProjects]);

  const createProject = useCallback(
    async (title: string): Promise<CreatorProjectMeta | null> => {
      const trimmed = title.trim();
      if (!trimmed) {
        return null;
      }

      // server 模式：只走 server，不 fallthrough 到本地 IndexedDB
      if (workbench.mode === "server") {
        const serverResult = await workbench.createProject(trimmed);
        if (serverResult) {
          // server 成功后 useWorkbench 自动刷新，
          // useEffect 会把 serverProjects 同步到 projects
          return {
            id: serverResult.id as CreatorProjectId,
            title: serverResult.title,
            description: "",
            emptyTitle: FALLBACK_EMPTY_TITLE,
            emptyDescription: FALLBACK_EMPTY_DESCRIPTION
          };
        }
        // server 失败：直接返回 null，不写本地 IndexedDB
        return null;
      }

      // 非 server 模式：fallback 到本地 IndexedDB
      if (!canUseIndexedDB()) {
        return null;
      }

      const now = new Date().toISOString();
      const stored: StoredProject = {
        id: createUserProjectId(),
        title: trimmed,
        description: "本地工作区",
        isBuiltin: false,
        createdAt: now,
        updatedAt: now,
        sortOrder: (await listProjects()).length
      };
      await saveProject(stored);
      await reloadLocal();
      return toMeta(stored);
    },
    [reloadLocal, workbench]
  );

  const renameProject = useCallback(
    async (id: CreatorProjectId, title: string): Promise<void> => {
      const trimmed = title.trim();
      if (!trimmed) {
        return;
      }

      // server 模式：只走 server，不 fallthrough 到本地 IndexedDB
      if (workbench.mode === "server") {
        await workbench.renameProject(id, trimmed);
        // 无论成功失败都不写本地，避免 drift
        return;
      }

      // 非 server 模式：fallback 到本地 IndexedDB
      if (!canUseIndexedDB()) {
        return;
      }
      await renameStoredProject(id, trimmed);
      await reloadLocal();
    },
    [reloadLocal, workbench]
  );

  const deleteProject = useCallback(
    async (id: CreatorProjectId): Promise<void> => {
      // server 模式：只走 server，不 fallthrough 到本地 IndexedDB
      if (workbench.mode === "server") {
        await workbench.deleteProject(id);
        // 无论成功失败都不写本地，避免 drift
        return;
      }

      // 非 server 模式：fallback 到本地 IndexedDB
      if (!canUseIndexedDB()) {
        return;
      }
      await deleteStoredProject(id);
      await reloadLocal();
    },
    [reloadLocal, workbench]
  );

  const refresh = useCallback(async () => {
    await workbench.refresh();
    await reloadLocal();
  }, [reloadLocal, workbench]);

  return useMemo(
    () => ({
      projects,
      isLoading,
      createProject,
      renameProject,
      deleteProject,
      refresh
    }),
    [projects, isLoading, createProject, renameProject, deleteProject, refresh]
  );
}
