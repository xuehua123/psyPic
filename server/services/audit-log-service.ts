import { basename, dirname, join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
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

type PrismaAuditLogRecord = {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  metadata: unknown;
  createdAt: Date;
};

type PrismaAuditClient = {
  auditLog: {
    create(input: {
      data: {
        id: string;
        actorUserId: string | null;
        action: string;
        targetType: string;
        targetId: string;
        requestId: string;
        metadata: unknown;
        createdAt: Date;
      };
    }): Promise<unknown>;
    findMany(input: {
      where?: { action?: string };
      orderBy: Array<{ createdAt?: "desc" } | { id?: "desc" }>;
      cursor?: { id: string };
      skip?: number;
      take: number;
    }): Promise<PrismaAuditLogRecord[]>;
  };
};

declare global {
  var __psypicAuditLogs: Map<string, AuditLogRecord> | undefined;
  var __psypicAuditLogsLoaded: boolean | undefined;
  var __psypicAuditPrismaClient: PrismaAuditClient | null | undefined;
}

const auditLogs = globalThis.__psypicAuditLogs ?? new Map<string, AuditLogRecord>();
globalThis.__psypicAuditLogs = auditLogs;

export function resetAuditLogStore(options?: { deletePersisted?: boolean }) {
  auditLogs.clear();
  globalThis.__psypicAuditLogsLoaded = false;

  if (options?.deletePersisted === false) {
    return;
  }

  const storePath = getAuditLogStorePath();
  if (existsSync(storePath)) {
    rmSync(storePath, { force: true });
  }
}

export async function recordAuditLog(input: {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  metadata?: unknown;
}) {
  ensureAuditLogsLoaded();
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
  const persistedToDatabase = await writeDatabaseAuditLog(log);

  if (!persistedToDatabase) {
    writePersistedAuditLogs();
  }

  return serializeAuditLog(log);
}

export async function listAuditLogs(input?: {
  cursor?: string | null;
  limit?: number;
  action?: string | null;
}) {
  const databaseLogs = await listDatabaseAuditLogs(input);

  if (databaseLogs) {
    return databaseLogs;
  }

  ensureAuditLogsLoaded();
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

async function writeDatabaseAuditLog(log: AuditLogRecord) {
  const client = await getPrismaAuditClient();

  if (!client) {
    return false;
  }

  try {
    await client.auditLog.create({
      data: {
        id: log.id,
        actorUserId: log.actor_user_id,
        action: log.action,
        targetType: log.target_type,
        targetId: log.target_id,
        requestId: log.request_id,
        metadata: log.metadata,
        createdAt: new Date(log.created_at)
      }
    });
    return true;
  } catch {
    return false;
  }
}

async function listDatabaseAuditLogs(input?: {
  cursor?: string | null;
  limit?: number;
  action?: string | null;
}) {
  const client = await getPrismaAuditClient();

  if (!client) {
    return null;
  }

  try {
    const limit = clampAuditLimit(input?.limit);
    const action = input?.action?.trim();
    const rows = await client.auditLog.findMany({
      where: action ? { action } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      cursor: input?.cursor ? { id: input.cursor } : undefined,
      skip: input?.cursor ? 1 : 0,
      take: limit + 1
    });
    const page = rows.slice(0, limit).map(fromPrismaAuditLogRecord);

    return {
      items: page.map(serializeAuditLog),
      nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null
    };
  } catch {
    return null;
  }
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

function ensureAuditLogsLoaded() {
  if (globalThis.__psypicAuditLogsLoaded) {
    return;
  }

  const persistedLogs = readPersistedAuditLogs();
  auditLogs.clear();
  for (const log of persistedLogs) {
    auditLogs.set(log.id, log);
  }
  globalThis.__psypicAuditLogsLoaded = true;
}

function readPersistedAuditLogs() {
  const storePath = getAuditLogStorePath();

  if (!existsSync(storePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isAuditLogRecord);
  } catch {
    return [];
  }
}

function writePersistedAuditLogs() {
  const storePath = getAuditLogStorePath();
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(
    `${storePath}.tmp`,
    JSON.stringify(Array.from(auditLogs.values()), null, 2),
    "utf8"
  );
  renameSync(`${storePath}.tmp`, storePath);
}

async function getPrismaAuditClient() {
  if (!shouldUseDatabaseAuditLogs()) {
    return null;
  }

  if (globalThis.__psypicAuditPrismaClient !== undefined) {
    return globalThis.__psypicAuditPrismaClient;
  }

  try {
    const prismaClientPackage = "@prisma/client";
    const prismaModule = (await import(
      /* turbopackIgnore: true */ prismaClientPackage
    )) as {
      PrismaClient?: new () => PrismaAuditClient;
    };

    globalThis.__psypicAuditPrismaClient = prismaModule.PrismaClient
      ? new prismaModule.PrismaClient()
      : null;
  } catch {
    globalThis.__psypicAuditPrismaClient = null;
  }

  return globalThis.__psypicAuditPrismaClient;
}

function shouldUseDatabaseAuditLogs() {
  const mode = process.env.PSYPIC_AUDIT_LOG_STORE?.trim().toLowerCase();

  if (mode === "file") {
    return false;
  }

  return (
    mode === "database" ||
    mode === "db" ||
    (process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL))
  );
}

function getAuditLogStorePath() {
  const fileName = basename(
    process.env.PSYPIC_AUDIT_LOG_FILE?.trim() || "audit-logs.json"
  );

  return join(/* turbopackIgnore: true */ process.cwd(), ".data", fileName);
}

function fromPrismaAuditLogRecord(log: PrismaAuditLogRecord): AuditLogRecord {
  return {
    id: log.id,
    actor_user_id: log.actorUserId,
    action: log.action,
    target_type: log.targetType,
    target_id: log.targetId,
    request_id: log.requestId,
    metadata: log.metadata,
    created_at: log.createdAt.toISOString()
  };
}

function isAuditLogRecord(value: unknown): value is AuditLogRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const log = value as Record<string, unknown>;

  return (
    typeof log.id === "string" &&
    (typeof log.actor_user_id === "string" || log.actor_user_id === null) &&
    typeof log.action === "string" &&
    typeof log.target_type === "string" &&
    typeof log.target_id === "string" &&
    typeof log.request_id === "string" &&
    typeof log.created_at === "string"
  );
}
