import { createId, redactSensitiveValue } from "@/server/services/key-binding-service";

export type AuditLogRecord = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  request_id: string;
  metadata: unknown;
  created_at: string;
};

declare global {
  var __psypicAuditLogs: Map<string, AuditLogRecord> | undefined;
}

const auditLogs = globalThis.__psypicAuditLogs ?? new Map<string, AuditLogRecord>();
globalThis.__psypicAuditLogs = auditLogs;

export function resetAuditLogStore() {
  auditLogs.clear();
}

export function recordAuditLog(input: {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  metadata?: unknown;
}) {
  const now = new Date().toISOString();
  const log: AuditLogRecord = {
    id: createId("audit"),
    actor_user_id: input.actorUserId ?? null,
    action: input.action.trim().slice(0, 120),
    target_type: input.targetType.trim().slice(0, 80),
    target_id: input.targetId.trim().slice(0, 120),
    request_id: input.requestId,
    metadata: redactAuditMetadata(input.metadata ?? {}),
    created_at: now
  };

  auditLogs.set(log.id, log);
  return serializeAuditLog(log);
}

export function listAuditLogs(input?: {
  cursor?: string | null;
  limit?: number;
  action?: string | null;
}) {
  const limit = clampAuditLimit(input?.limit);
  const action = input?.action?.trim();
  const logs = Array.from(auditLogs.values())
    .filter((log) => (action ? log.action === action : true))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const startIndex = input?.cursor
    ? logs.findIndex((log) => log.id === input.cursor) + 1
    : 0;
  const safeStartIndex = Math.max(startIndex, 0);
  const page = logs.slice(safeStartIndex, safeStartIndex + limit);
  const hasNextPage = logs.length > safeStartIndex + page.length;

  return {
    items: page.map(serializeAuditLog),
    nextCursor: hasNextPage ? page.at(-1)?.id ?? null : null
  };
}

function serializeAuditLog(log: AuditLogRecord) {
  return {
    audit_id: log.id,
    actor_user_id: log.actor_user_id,
    action: log.action,
    target_type: log.target_type,
    target_id: log.target_id,
    request_id: log.request_id,
    metadata: log.metadata,
    created_at: log.created_at
  };
}

function redactAuditMetadata(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveValue(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactAuditMetadata);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveMetadataKey(key) ? "[REDACTED]" : redactAuditMetadata(item)
    ])
  );
}

function isSensitiveMetadataKey(key: string) {
  return /(authorization|api[_-]?key|token|secret|cookie|psypic_session)/i.test(
    key
  );
}

function clampAuditLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    return 50;
  }

  return Math.min(Math.max(limit, 1), 100);
}
