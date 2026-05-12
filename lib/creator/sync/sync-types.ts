/**
 * Offline sync 类型定义。
 *
 * 职责：
 *   - 定义 sync 状态机（synced / syncing / offline / needs_attention）。
 *   - 定义冲突记录结构。
 *   - 定义 sync engine 依赖接口（便于测试注入）。
 *
 * 不做：Board Mode / Task Dock。
 */

export type SyncStatus =
  | "synced"      // 所有操作已同步
  | "syncing"     // 正在推送/拉取
  | "offline"     // 网络不可用或 503
  | "needs_attention"; // 存在未解决冲突

export type ConflictRecord = {
  /** 客户端 mutation id */
  clientMutationId: string;
  /** 实体类型 */
  entity: "project" | "session" | "version_node";
  /** 实体 id */
  entityId: string;
  /** 服务器当前记录 */
  serverRecord: unknown;
  /** 冲突时间 */
  detectedAt: string;
};

export type SyncState = {
  status: SyncStatus;
  /** 待推送操作数 */
  pendingCount: number;
  /** 未解决冲突列表 */
  conflicts: ConflictRecord[];
  /** 上次成功同步时间 */
  lastSyncTime: string | null;
  /** 503 Retry-After */
  retryAfter: string | null;
};

export const INITIAL_SYNC_STATE: SyncState = {
  status: "synced",
  pendingCount: 0,
  conflicts: [],
  lastSyncTime: null,
  retryAfter: null
};

/** 单次 flush 最大操作数（防止无限批次） */
export const MAX_FLUSH_BATCH_SIZE = 25;
