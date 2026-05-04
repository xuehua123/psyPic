"use client";

/**
 * Sidebar 项目折叠状态 hook（plan slug clever-swimming-pumpkin · Cut 1）。
 *
 * 行为：
 *   - 内部 state: `Set<CreatorProjectId>`，存「折叠的」项目 id
 *   - 首次 mount：读 localStorage（key `psypic_sidebar_collapsed_projects`）
 *     - 有 ⇒ 用存的状态
 *     - 无 / 解析失败 ⇒ 默认「除 active 外全部折叠」
 *   - toggle(id)：在 set 里加/删，并写 localStorage
 *   - active 变化时**不**自动展开新 active —— 用户已经手动 toggle 过的状态优先；
 *     默认值仅在 first mount 且 localStorage 空时生效
 *   - SSR safe：`typeof window === "undefined"` 直接走默认逻辑，不读 localStorage
 *
 * 不引外部依赖；和 use-projects.ts 一样自写 mountedRef 兜底。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CreatorProjectId } from "@/lib/creator/types";

const STORAGE_KEY = "psypic_sidebar_collapsed_projects";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStored(): CreatorProjectId[] | null {
  if (!canUseStorage()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((item): item is CreatorProjectId => typeof item === "string");
  } catch {
    // 垃圾值 / quota / 其他异常 —— 兜底用默认
    return null;
  }
}

function writeStored(ids: ReadonlySet<CreatorProjectId>): void {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // quota exceeded 等忽略，下次 toggle 仍会重试
  }
}

export type UseCollapsedProjectsReturn = {
  isCollapsed: (id: CreatorProjectId) => boolean;
  toggle: (id: CreatorProjectId) => void;
};

/**
 * 项目折叠状态 hook。
 *
 * @param projectIds 当前所有项目 id（作为默认值的全集）
 * @param activeProjectId 当前 active 项目 id（首次 mount 时唯一不折叠的项目）
 */
export function useCollapsedProjects(
  projectIds: CreatorProjectId[],
  activeProjectId: CreatorProjectId
): UseCollapsedProjectsReturn {
  // 第一次 mount 时确定初值；后续 projects 变化不再覆盖（避免新增/删除项目把
  // 用户手动 toggle 的状态冲掉）。
  const [collapsed, setCollapsed] = useState<Set<CreatorProjectId>>(() => {
    const stored = readStored();
    if (stored !== null) {
      return new Set(stored);
    }
    // 默认：除 active 外全部折叠
    return new Set(projectIds.filter((id) => id !== activeProjectId));
  });

  /** 防止 setState on unmounted。 */
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isCollapsed = useCallback(
    (id: CreatorProjectId) => collapsed.has(id),
    [collapsed]
  );

  const toggle = useCallback((id: CreatorProjectId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      writeStored(next);
      return next;
    });
  }, []);

  return useMemo(() => ({ isCollapsed, toggle }), [isCollapsed, toggle]);
}
