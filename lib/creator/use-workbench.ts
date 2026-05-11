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
 *   6. 503/network_error 时 CRUD 写入 outbox + optimistic cache update。
 *   7. 401/403 时 CRUD 不写 outbox，进入 needs_attention。
 *   8. 暴露 sync 状态（Cut 5），支持 outbox flush 和 conflict indicator。
 *
 * 不做：
 *   - 不接 generation/edit context。
 *   - 不接 Board Mode / Task Dock。
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  listProjects as apiListProjects,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  pushWorkbenchChanges as apiPushWorkbenchChanges,
  pullWorkbenchChanges as apiPullWorkbenchChanges
} from "./workbench-api";
import {
  listCachedProjects,
  saveCachedProject,
  deleteCachedProject,
  deleteCachedSession,
  deleteCachedVersionNode
} from "./workbench-cache-store";
import {
  listOutboxOperations,
  addOutboxOperation,
  removeOutboxOperations
} from "./workbench-outbox-store";
import { mapWorkbenchProjectToStoredProject } from "./workbench-mappers";
import { flushOutbox, dismissConflict } from "./sync/sync-engine";
import type { SyncState } from "./sync/sync-types";
import { INITIAL_SYNC_STATE } from "./sync/sync-types";
import type { SyncEngineDeps } from "./sync/sync-engine";
import type { WorkbenchProject, WorkbenchSyncPullResponse } from "./workbench-types";
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
  /** 当前 sync 状态 */
  syncState: SyncState;
  /** 手动触发 outbox flush */
  flushSync: () => Promise<void>;
  /** 清除指定冲突 */
  dismissSyncConflict: (clientMutationId: string) => void;
};

/** 判断 API 错误码是否为 auth 错误 */
function isAuthError(code: string): boolean {
  return code === "unauthorized" || code === "http_401" || code === "http_403" || code === "forbidden";
}

/** 判断 API 错误码是否可入 outbox（503 / network_error 等可重试错误） */
function isRetryableError(code: string): boolean {
  return !isAuthError(code);
}

/** 生成稳定 client_mutation_id */
let mutationCounter = 0;
function nextMutationId(): string {
  mutationCounter += 1;
  return `cmid_${Date.now()}_${mutationCounter}`;
}

export function useWorkbench(): UseWorkbenchReturn {
  const [mode, setMode] = useState<WorkbenchMode>("loading");
  const [serverProjects, setServerProjects] = useState<StoredProject[]>([]);
  const [rawServerProjects, setRawServerProjects] = useState<WorkbenchProject[]>([]);
  const [retryAfter, setRetryAfter] = useState<string | undefined>(undefined);
  const [syncState, setSyncState] = useState<SyncState>(INITIAL_SYNC_STATE);
  const isMountedRef = useRef(true);
  const isFlushingRef = useRef(false);

  // ref 镜像 syncState，解决闭包旧值问题
  const syncStateRef = useRef<SyncState>(INITIAL_SYNC_STATE);
  useEffect(() => {
    syncStateRef.current = syncState;
  }, [syncState]);

  // sync engine 依赖
  const buildSyncDeps = useCallback((): SyncEngineDeps => ({
    listOutboxOperations,
    removeOutboxOperations,
    pushWorkbenchChanges: apiPushWorkbenchChanges,
    pullWorkbenchChanges: apiPullWorkbenchChanges,
    applyCacheTombstones: async (tombstones) => {
      for (const id of tombstones.deletedProjectIds) {
        await deleteCachedProject(id).catch(() => {});
      }
      for (const id of tombstones.deletedSessionIds) {
        await deleteCachedSession(id).catch(() => {});
      }
      for (const id of tombstones.deletedVersionNodeIds) {
        await deleteCachedVersionNode(id).catch(() => {});
      }
    },
    savePulledData: async (pulled: WorkbenchSyncPullResponse) => {
      for (const p of (pulled.projects ?? []).filter((pr) => pr.deleted_at === null)) {
        await saveCachedProject(p).catch(() => {});
      }
    }
  }), []);

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
        if (isMountedRef.current) {
          setMode("fallback");
        }
        return;
      }
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
      if (isAuthError(code)) {
        setMode("auth_error");
        setRetryAfter(undefined);
      } else {
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

  const doFlush = useCallback(async () => {
    // 防止并发 flush
    if (isFlushingRef.current) return;
    isFlushingRef.current = true;

    try {
      setSyncState((prev) => ({ ...prev, status: "syncing" }));
      const deps = buildSyncDeps();
      // 使用 ref 镜像获取最新 syncState，避免闭包旧值
      const newState = await flushOutbox(syncStateRef.current, deps);
      if (isMountedRef.current) {
        setSyncState(newState);
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [buildSyncDeps]);

  // app focus / online 时自动 flush
  useEffect(() => {
    const handleFocusOrOnline = () => {
      if (isMountedRef.current) {
        void doFlush();
      }
    };

    window.addEventListener("focus", handleFocusOrOnline);
    window.addEventListener("online", handleFocusOrOnline);

    return () => {
      window.removeEventListener("focus", handleFocusOrOnline);
      window.removeEventListener("online", handleFocusOrOnline);
    };
  }, [doFlush]);

  const handleDismissConflict = useCallback((clientMutationId: string) => {
    setSyncState((prev) => dismissConflict(prev, clientMutationId));
  }, []);

  // --- CRUD with outbox fallback ---

  const createProject = useCallback(
    async (title: string): Promise<WorkbenchProject | null> => {
      const result = await apiCreateProject({ title });

      if (result.success) {
        await saveCachedProject(result.data).catch(() => {});
        await loadFromServer();
        return result.data;
      }

      // API 失败 → 分流
      const code = result.error?.code ?? "network_error";

      if (isAuthError(code)) {
        // auth 错误不写 outbox，进入 needs_attention
        setSyncState((prev) => ({ ...prev, status: "needs_attention" }));
        return null;
      }

      if (isRetryableError(code)) {
        // 503/network_error → 写入 outbox + optimistic cache
        const mutId = nextMutationId();
        const optimisticId = `optimistic_${mutId}`;
        const now = new Date().toISOString();

        await addOutboxOperation({
          client_mutation_id: mutId,
          entity: "project",
          action: "upsert",
          data: { id: optimisticId, title, updated_at: now }
        }).catch(() => {});

        setSyncState((prev) => ({
          ...prev,
          status: "offline",
          pendingCount: prev.pendingCount + 1,
          retryAfter: result.retryAfter ?? prev.retryAfter
        }));

        // optimistic：返回假 project 给 UI
        return {
          id: optimisticId,
          user_id: "",
          title,
          sort_order: 0,
          collapsed: false,
          active_session_id: null,
          created_at: now,
          updated_at: now,
          deleted_at: null
        };
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

      const code = result.error?.code ?? "network_error";

      if (isAuthError(code)) {
        setSyncState((prev) => ({ ...prev, status: "needs_attention" }));
        return false;
      }

      if (isRetryableError(code)) {
        const mutId = nextMutationId();
        await addOutboxOperation({
          client_mutation_id: mutId,
          entity: "project",
          action: "upsert",
          data: { id, title, updated_at: new Date().toISOString() }
        }).catch(() => {});

        setSyncState((prev) => ({
          ...prev,
          status: "offline",
          pendingCount: prev.pendingCount + 1,
          retryAfter: result.retryAfter ?? prev.retryAfter
        }));

        return true; // optimistic success
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

      const code = result.error?.code ?? "network_error";

      if (isAuthError(code)) {
        setSyncState((prev) => ({ ...prev, status: "needs_attention" }));
        return false;
      }

      if (isRetryableError(code)) {
        const mutId = nextMutationId();
        await addOutboxOperation({
          client_mutation_id: mutId,
          entity: "project",
          action: "delete",
          data: { id, updated_at: new Date().toISOString() }
        }).catch(() => {});

        // optimistic cache delete
        await deleteCachedProject(id).catch(() => {});

        setSyncState((prev) => ({
          ...prev,
          status: "offline",
          pendingCount: prev.pendingCount + 1,
          retryAfter: result.retryAfter ?? prev.retryAfter
        }));

        return true; // optimistic success
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
    refresh: loadFromServer,
    syncState,
    flushSync: doFlush,
    dismissSyncConflict: handleDismissConflict
  };
}
