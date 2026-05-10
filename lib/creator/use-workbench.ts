"use client";

/**
 * Workbench server-first 数据层 hook。
 *
 * 职责：
 *   1. 尝试从 /api/workbench/projects 拉取服务端项目列表。
 *   2. 成功后更新本地 IndexedDB cache (workbench-cache-store)。
 *   3. 失败时（503 / network_error）保持 fallback 状态，让调用方继续用本地数据。
 *   4. 401/403 不被当作 503 fallback 成功——保留为 auth/permission 状态。
 *   5. 提供 server-first CRUD（create/rename/delete project），成功后刷新 cache。
 *
 * 不做：
 *   - 不接 VersionNode 主数据流（Cut 4）。
 *   - 不启动自动 sync（Cut 5）。
 *   - 不接 generation/edit context。
 *   - 不接 Board Mode / Task Dock。
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  listProjects as apiListProjects,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject
} from "./workbench-api";
import {
  listCachedProjects,
  saveCachedProject,
  deleteCachedProject
} from "./workbench-cache-store";
import { mapWorkbenchProjectToStoredProject } from "./workbench-mappers";
import type { WorkbenchProject } from "./workbench-types";
import type { StoredProject } from "./projects-store";

export type WorkbenchMode =
  | "loading"
  | "server"
  | "fallback"
  | "auth_error";

export type UseWorkbenchReturn = {
  /** 当前模式：loading / server（API 可用）/ fallback（503/离线）/ auth_error（401/403） */
  mode: WorkbenchMode;
  /** server projects 转换后的 StoredProject[]；fallback 模式下为空数组 */
  serverProjects: StoredProject[];
  /** 原始 WorkbenchProject[]，供 generation context 查找 active_session_id */
  rawServerProjects: WorkbenchProject[];
  /** 503 时的 Retry-After */
  retryAfter: string | undefined;
  /** server-first 创建项目；返回新项目或 null */
  createProject: (title: string) => Promise<WorkbenchProject | null>;
  /** server-first 重命名项目 */
  renameProject: (id: string, title: string) => Promise<boolean>;
  /** server-first 删除项目 */
  deleteProject: (id: string) => Promise<boolean>;
  /** 手动刷新 */
  refresh: () => Promise<void>;
};

export function useWorkbench(): UseWorkbenchReturn {
  const [mode, setMode] = useState<WorkbenchMode>("loading");
  const [serverProjects, setServerProjects] = useState<StoredProject[]>([]);
  const [rawServerProjects, setRawServerProjects] = useState<WorkbenchProject[]>([]);
  const [retryAfter, setRetryAfter] = useState<string | undefined>(undefined);
  const isMountedRef = useRef(true);

  const loadFromServer = useCallback(async () => {
    // 先试从 cache 读
    try {
      const cached = await listCachedProjects();
      if (isMountedRef.current && cached.length > 0) {
        setServerProjects(cached.map(mapWorkbenchProjectToStoredProject));
      }
    } catch {
      // cache 读取失败不影响主流程
    }

    // 然后从 server 刷新
    const result = await apiListProjects();

    if (!isMountedRef.current) return;

    if (result.success) {
      const projects = result.data?.items;
      if (!Array.isArray(projects)) {
        // 响应格式不匹配 workbench list（可能是 fetch mock 干扰）
        if (isMountedRef.current) {
          setMode("fallback");
        }
        return;
      }
      // 更新 cache
      for (const project of projects) {
        await saveCachedProject(project).catch(() => {});
      }
      if (isMountedRef.current) {
        setServerProjects(projects.map(mapWorkbenchProjectToStoredProject));
        setRawServerProjects(projects);
        setMode("server");
        setRetryAfter(undefined);
      }
    } else {
      const code = result.error.code;
      if (code === "unauthorized" || code === "http_401" || code === "http_403" || code === "forbidden") {
        setMode("auth_error");
        setRetryAfter(undefined);
      } else {
        // 503 / network_error / workbench_store_unavailable → fallback
        setMode("fallback");
        setRetryAfter(result.retryAfter);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFromServer();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadFromServer]);

  const createProject = useCallback(
    async (title: string): Promise<WorkbenchProject | null> => {
      const result = await apiCreateProject({ title });
      if (result.success) {
        await saveCachedProject(result.data).catch(() => {});
        await loadFromServer();
        return result.data;
      }
      return null;
    },
    [loadFromServer]
  );

  const renameProject = useCallback(
    async (id: string, title: string): Promise<boolean> => {
      const result = await apiUpdateProject(id, { title });
      if (result.success) {
        await saveCachedProject(result.data).catch(() => {});
        await loadFromServer();
        return true;
      }
      return false;
    },
    [loadFromServer]
  );

  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await apiDeleteProject(id);
      if (result.success) {
        await deleteCachedProject(id).catch(() => {});
        await loadFromServer();
        return true;
      }
      return false;
    },
    [loadFromServer]
  );

  return {
    mode,
    serverProjects,
    rawServerProjects,
    retryAfter,
    createProject,
    renameProject,
    deleteProject,
    refresh: loadFromServer
  };
}
