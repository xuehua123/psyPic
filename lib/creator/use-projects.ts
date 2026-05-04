"use client";

/**
 * 创作台项目 CRUD 的 React hook 层。
 *
 * 数据流：
 *   IndexedDB (`psypic_projects` store, see lib/creator/projects-store.ts)
 *     └─ listProjects() ─ toMeta() ─→ CreatorProjectMeta[]
 *
 * 首次挂载若 IndexedDB 为空，写入 4 个 default seed
 * （`defaultProjectSeeds`）；IndexedDB 不可用（SSR / 旧浏览器）时直接
 * fallback 到 seed 数组（read-only），新建/重命名/删除变 no-op。
 *
 * 与 lib/prompts/prompt-favorites.ts 同模式：data 层 + hook 层分离，
 * 不引 dexie。
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
  const [isLoading, setIsLoading] = useState(true);
  /** 防止 setState on unmounted —— 卸载后 reload 完成不再写状态。 */
  const isMountedRef = useRef(true);

  const reload = useCallback(async () => {
    if (!canUseIndexedDB()) {
      if (isMountedRef.current) {
        setProjects(defaultProjectSeeds.map((seed) => ({ ...seed })));
        setIsLoading(false);
      }
      return;
    }

    const stored = await listProjects();
    if (!isMountedRef.current) {
      return;
    }
    setProjects(stored.map(toMeta));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    (async () => {
      if (!canUseIndexedDB()) {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
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
      await reload();
    })();

    return () => {
      isMountedRef.current = false;
    };
  }, [reload]);

  const createProject = useCallback(
    async (title: string): Promise<CreatorProjectMeta | null> => {
      const trimmed = title.trim();
      if (!trimmed || !canUseIndexedDB()) {
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
        // 排到末尾：用 listProjects 长度作为 sortOrder（够用，
        // 后续如果做拖拽排序可以重做）
        sortOrder: (await listProjects()).length
      };
      await saveProject(stored);
      await reload();
      return toMeta(stored);
    },
    [reload]
  );

  const renameProject = useCallback(
    async (id: CreatorProjectId, title: string): Promise<void> => {
      const trimmed = title.trim();
      if (!trimmed || !canUseIndexedDB()) {
        return;
      }
      await renameStoredProject(id, trimmed);
      await reload();
    },
    [reload]
  );

  const deleteProject = useCallback(
    async (id: CreatorProjectId): Promise<void> => {
      if (!canUseIndexedDB()) {
        return;
      }
      await deleteStoredProject(id);
      await reload();
    },
    [reload]
  );

  return useMemo(
    () => ({
      projects,
      isLoading,
      createProject,
      renameProject,
      deleteProject,
      refresh: reload
    }),
    [projects, isLoading, createProject, renameProject, deleteProject, reload]
  );
}
