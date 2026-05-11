/**
 * Workbench offline sync engine。
 *
 * 职责：
 *   1. flushOutbox：从 outbox 取 bounded batch，推送到 /api/workbench/sync，
 *      处理 push_results（清理/冲突/auth），应用 tombstones，返回新 SyncState。
 *   2. pullChanges：拉取 server 增量，应用 tombstones，更新 cache。
 *   3. 不做自动无限重试；flush 必须有明确触发。
 *   4. 503 / network_error → offline，不丢 outbox。
 *   5. 401/403 → auth_error，不当作 offline 成功。
 *
 * 不做：Board Mode / Task Dock / generation/edit context 修改。
 */

import type {
  WorkbenchSyncPullResponse,
  WorkbenchSyncPushResponse,
  WorkbenchSyncOperation
} from "../workbench-types";
import { resolvePushResults, extractTombstones } from "./conflict-resolver";
import type { SyncState, ConflictRecord } from "./sync-types";
import { INITIAL_SYNC_STATE, MAX_FLUSH_BATCH_SIZE } from "./sync-types";

// 依赖注入接口：便于测试
export type SyncEngineDeps = {
  listOutboxOperations: () => Promise<Array<WorkbenchSyncOperation & { created_at: string }>>;
  removeOutboxOperations: (ids: string[]) => Promise<void>;
  pushWorkbenchChanges: (data: {
    operations: WorkbenchSyncOperation[];
    pull?: { updated_since: string };
  }) => Promise<{ success: boolean; data?: WorkbenchSyncPushResponse; error?: { code: string; message: string }; retryAfter?: string }>;
  pullWorkbenchChanges: (updatedSince?: string) => Promise<{ success: boolean; data?: WorkbenchSyncPullResponse; error?: { code: string; message: string }; retryAfter?: string }>;
  applyCacheTombstones: (tombstones: {
    deletedProjectIds: string[];
    deletedSessionIds: string[];
    deletedVersionNodeIds: string[];
  }) => Promise<void>;
  savePulledData: (pulled: WorkbenchSyncPullResponse) => Promise<void>;
};

/**
 * 从 outbox flush mutations 到 server。
 * 返回更新后的 SyncState。
 */
export async function flushOutbox(
  currentState: SyncState,
  deps: SyncEngineDeps
): Promise<SyncState> {
  // 读取 outbox
  let operations: Array<WorkbenchSyncOperation & { created_at: string }>;
  try {
    operations = await deps.listOutboxOperations();
  } catch {
    return { ...currentState, status: "offline" };
  }

  // 没有待推送 → synced
  if (operations.length === 0) {
    return {
      ...currentState,
      status: currentState.conflicts.length > 0 ? "needs_attention" : "synced",
      pendingCount: 0
    };
  }

  // bounded batch
  const batch = operations.slice(0, MAX_FLUSH_BATCH_SIZE);
  const syncOperations: WorkbenchSyncOperation[] = batch.map(
    ({ created_at: _ca, ...op }) => op
  );

  // 推送
  let result: Awaited<ReturnType<SyncEngineDeps["pushWorkbenchChanges"]>>;
  try {
    result = await deps.pushWorkbenchChanges({
      operations: syncOperations,
      ...(currentState.lastSyncTime
        ? { pull: { updated_since: currentState.lastSyncTime } }
        : {})
    });
  } catch {
    // 网络错误 → offline，保留 outbox
    return {
      ...currentState,
      status: "offline",
      pendingCount: operations.length
    };
  }

  if (!result.success) {
    const code = result.error?.code ?? "";

    // 401/403 → auth_error
    if (code === "unauthorized" || code === "http_401" || code === "forbidden" || code === "http_403") {
      return {
        ...currentState,
        status: "needs_attention",
        pendingCount: operations.length
      };
    }

    // 503 / network_error → offline
    return {
      ...currentState,
      status: "offline",
      pendingCount: operations.length,
      retryAfter: result.retryAfter ?? null
    };
  }

  // 解析 push results
  const pushResults = result.data?.push_results ?? [];
  const resolved = resolvePushResults(pushResults);

  // 清理 outbox（applied + replayed + error）
  if (resolved.clearedMutationIds.length > 0) {
    try {
      await deps.removeOutboxOperations(resolved.clearedMutationIds);
    } catch {
      // outbox 清理失败不影响主流程
    }
  }

  // 应用 tombstones（如果有 pull response）
  if (result.data?.pulled) {
    const tombstones = extractTombstones(result.data.pulled);
    try {
      await deps.applyCacheTombstones(tombstones);
      await deps.savePulledData(result.data.pulled);
    } catch {
      // cache 操作失败不影响 sync 状态
    }
  }

  // 合并冲突
  const allConflicts: ConflictRecord[] = [
    ...currentState.conflicts,
    ...resolved.newConflicts
  ];

  // 计算剩余 pending
  const remaining = operations.length - resolved.clearedMutationIds.length;

  // 决定新状态
  let newStatus: SyncState["status"];
  if (resolved.hasAuthError || allConflicts.length > 0) {
    newStatus = "needs_attention";
  } else if (remaining > 0) {
    // 还有剩余，但本次 batch 成功 → 仍需下次 flush
    newStatus = "synced";
  } else {
    newStatus = "synced";
  }

  return {
    status: newStatus,
    pendingCount: Math.max(0, remaining),
    conflicts: allConflicts,
    lastSyncTime: result.data?.pulled?.last_sync_time ?? currentState.lastSyncTime,
    retryAfter: null
  };
}

/**
 * 拉取 server 增量变化。
 */
export async function pullChanges(
  currentState: SyncState,
  deps: SyncEngineDeps
): Promise<SyncState> {
  let result: Awaited<ReturnType<SyncEngineDeps["pullWorkbenchChanges"]>>;
  try {
    result = await deps.pullWorkbenchChanges(currentState.lastSyncTime ?? undefined);
  } catch {
    return { ...currentState, status: "offline" };
  }

  if (!result.success) {
    const code = result.error?.code ?? "";
    if (code === "unauthorized" || code === "http_401" || code === "forbidden" || code === "http_403") {
      return { ...currentState, status: "needs_attention" };
    }
    return {
      ...currentState,
      status: "offline",
      retryAfter: result.retryAfter ?? null
    };
  }

  const pulled = result.data;
  if (!pulled) {
    return currentState;
  }

  // 应用 tombstones
  const tombstones = extractTombstones(pulled);
  try {
    await deps.applyCacheTombstones(tombstones);
    await deps.savePulledData(pulled);
  } catch {
    // cache 操作失败不影响 sync 状态
  }

  return {
    ...currentState,
    lastSyncTime: pulled.last_sync_time ?? currentState.lastSyncTime,
    retryAfter: null
  };
}

/**
 * 清除指定冲突。
 */
export function dismissConflict(
  state: SyncState,
  clientMutationId: string
): SyncState {
  const conflicts = state.conflicts.filter(
    (c) => c.clientMutationId !== clientMutationId
  );
  return {
    ...state,
    conflicts,
    status: conflicts.length > 0 ? "needs_attention" : (state.pendingCount > 0 ? "offline" : "synced")
  };
}

export { INITIAL_SYNC_STATE };
