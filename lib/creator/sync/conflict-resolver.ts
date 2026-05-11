/**
 * Conflict resolver：应用 sync push 结果到本地 cache。
 *
 * 职责：
 *   1. replay/applied → 从 outbox 清理对应 client_mutation_id。
 *   2. conflict → 记录到 conflicts 列表并进入 needs_attention 状态。
 *   3. error (auth) → hasAuthError = true，进入 needs_attention。
 *   4. error (non-auth) → 进入 needs_attention，不清除 outbox（保留 pending）。
 *   5. 不覆盖本地状态——冲突必须暴露给用户。
 *
 * Tombstone 处理：
 *   - pull response 中 deleted_at !== null 的记录从 cache 删除。
 *
 * 不做：Board Mode / Task Dock / 自动覆盖式合并。
 */

import type { WorkbenchSyncResult, WorkbenchSyncPullResponse } from "../workbench-types";
import type { ConflictRecord } from "./sync-types";

export type ConflictResolverResult = {
  /** 可以从 outbox 清理的 client_mutation_id 列表 */
  clearedMutationIds: string[];
  /** 新增冲突记录 */
  newConflicts: ConflictRecord[];
  /** auth 错误（401/403），不应视为可重试 */
  hasAuthError: boolean;
  /** 非 auth 的 error 数量（需要进入 needs_attention） */
  nonAuthErrorCount: number;
};

/**
 * 解析 push_results 数组，分流为可清理 / 冲突 / auth 错误。
 */
export function resolvePushResults(
  results: WorkbenchSyncResult[]
): ConflictResolverResult {
  const clearedMutationIds: string[] = [];
  const newConflicts: ConflictRecord[] = [];
  let hasAuthError = false;
  let nonAuthErrorCount = 0;

  for (const result of results) {
    switch (result.status) {
      case "applied":
      case "replayed":
        // 成功：从 outbox 清除
        clearedMutationIds.push(result.client_mutation_id);
        break;

      case "conflict":
        // 冲突：不清除 outbox，进入 needs_attention
        newConflicts.push({
          clientMutationId: result.client_mutation_id,
          entity: result.entity,
          entityId: result.id,
          serverRecord: result.server_record ?? null,
          detectedAt: new Date().toISOString()
        });
        break;

      case "error":
        // 401/403 是 auth 错误，不可静默重试
        if (result.code === "unauthorized" || result.code === "forbidden") {
          hasAuthError = true;
          // auth error 也从 outbox 清除（无法通过重试修复）
          clearedMutationIds.push(result.client_mutation_id);
        } else {
          // 非 auth error：不清除 outbox，保留 pending 进入 needs_attention
          nonAuthErrorCount += 1;
        }
        break;

      default:
        break;
    }
  }

  return { clearedMutationIds, newConflicts, hasAuthError, nonAuthErrorCount };
}

export type TombstoneResult = {
  /** 要从 cache 删除的 project ids */
  deletedProjectIds: string[];
  /** 要从 cache 删除的 session ids */
  deletedSessionIds: string[];
  /** 要从 cache 删除的 version node ids */
  deletedVersionNodeIds: string[];
};

/**
 * 从 pull response 中提取 tombstones（deleted_at !== null）。
 */
export function extractTombstones(
  pulled: WorkbenchSyncPullResponse
): TombstoneResult {
  const deletedProjectIds = (pulled.projects ?? [])
    .filter((p) => p.deleted_at !== null)
    .map((p) => p.id);
  const deletedSessionIds = (pulled.sessions ?? [])
    .filter((s) => s.deleted_at !== null)
    .map((s) => s.id);
  const deletedVersionNodeIds = (pulled.version_nodes ?? [])
    .filter((n) => n.deleted_at !== null)
    .map((n) => n.id);

  return { deletedProjectIds, deletedSessionIds, deletedVersionNodeIds };
}
