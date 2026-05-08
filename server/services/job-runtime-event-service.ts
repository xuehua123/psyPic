import { createId, redactSensitiveValue } from "@/server/services/key-binding-service";

export type JobRuntimeEventType =
  | "queued"
  | "running"
  | "partial_image"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out";

export type JobRuntimeEvent = {
  id: string;
  user_id: string;
  task_id: string;
  version_node_id: string | null;
  type: JobRuntimeEventType;
  payload: unknown;
  created_at: string;
};

type JobRuntimeEventRow = {
  id: string;
  userId: string;
  taskId: string;
  versionNodeId: string | null;
  type: JobRuntimeEventType;
  payload: unknown;
  createdAt: Date;
};

type JobRuntimeEventPrismaClient = {
  user?: {
    upsert(input: {
      where: { id: string };
      create: { id: string };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  jobRuntimeEvent: {
    create(input: { data: Record<string, unknown> }): Promise<JobRuntimeEventRow>;
    findMany(input: Record<string, unknown>): Promise<JobRuntimeEventRow[]>;
  };
};

declare global {
  var __psypicJobRuntimeEvents: Map<string, JobRuntimeEvent> | undefined;
  var __psypicJobRuntimeEventSequence: number | undefined;
  var __psypicJobRuntimeEventPrismaClient:
    | JobRuntimeEventPrismaClient
    | null
    | undefined;
}

const runtimeEvents =
  globalThis.__psypicJobRuntimeEvents ?? new Map<string, JobRuntimeEvent>();
globalThis.__psypicJobRuntimeEvents = runtimeEvents;

export function resetJobRuntimeEventStore() {
  runtimeEvents.clear();
  globalThis.__psypicJobRuntimeEventSequence = 0;
}

export async function recordJobRuntimeEvent(input: {
  userId: string;
  taskId: string;
  versionNodeId?: string | null;
  type: JobRuntimeEventType;
  payload?: unknown;
}) {
  const createdAt = new Date(
    Date.now() + (globalThis.__psypicJobRuntimeEventSequence ?? 0)
  ).toISOString();
  globalThis.__psypicJobRuntimeEventSequence =
    (globalThis.__psypicJobRuntimeEventSequence ?? 0) + 1;
  const event: JobRuntimeEvent = {
    id: createId("evt"),
    user_id: input.userId,
    task_id: input.taskId,
    version_node_id: input.versionNodeId ?? null,
    type: input.type,
    payload: redactPayload(input.payload ?? {}),
    created_at: createdAt
  };
  runtimeEvents.set(event.id, event);

  try {
    const client = await getPrismaJobRuntimeEventClient();
    if (!client) {
      return event;
    }

    await ensureDatabaseUser(client, event.user_id);
    await client.jobRuntimeEvent.create({
      data: {
        id: event.id,
        userId: event.user_id,
        taskId: event.task_id,
        versionNodeId: event.version_node_id,
        type: event.type,
        payload: event.payload,
        createdAt: new Date(event.created_at)
      }
    });
  } catch {
    // Runtime event persistence is best-effort for image task hot paths.
  }

  return event;
}

export async function listJobRuntimeEventsForUser(
  userId: string,
  input?: {
    taskId?: string | null;
    versionNodeId?: string | null;
    cursor?: string | null;
    limit?: number;
  }
) {
  const databaseEvents = await listDatabaseEventsForUser(userId, input);
  if (databaseEvents) {
    return databaseEvents;
  }

  const limit = clampLimit(input?.limit);
  const rows = Array.from(runtimeEvents.values())
    .filter((event) => event.user_id === userId)
    .filter((event) => (input?.taskId ? event.task_id === input.taskId : true))
    .filter((event) =>
      input?.versionNodeId ? event.version_node_id === input.versionNodeId : true
    )
    .sort(compareEvents);
  const startIndex = input?.cursor
    ? rows.findIndex((event) => event.id === input.cursor) + 1
    : 0;
  const safeStartIndex = Math.max(startIndex, 0);
  const page = rows.slice(safeStartIndex, safeStartIndex + limit);
  const hasNextPage = rows.length > safeStartIndex + page.length;

  return {
    items: page,
    nextCursor: hasNextPage ? page.at(-1)?.id ?? null : null
  };
}

async function listDatabaseEventsForUser(
  userId: string,
  input?: {
    taskId?: string | null;
    versionNodeId?: string | null;
    cursor?: string | null;
    limit?: number;
  }
) {
  const client = await getPrismaJobRuntimeEventClient();
  if (!client) {
    return null;
  }

  try {
    const limit = clampLimit(input?.limit);
    const where = {
      userId,
      ...(input?.taskId ? { taskId: input.taskId } : {}),
      ...(input?.versionNodeId ? { versionNodeId: input.versionNodeId } : {})
    };
    const rows = await client.jobRuntimeEvent.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: limit + 1
    });

    return {
      items: rows.slice(0, limit).map(fromPrismaJobRuntimeEvent),
      nextCursor: rows.length > limit ? rows[limit - 1]?.id ?? null : null
    };
  } catch {
    return null;
  }
}

async function getPrismaJobRuntimeEventClient() {
  if (!shouldUseDatabaseJobRuntimeEventStore()) {
    return null;
  }

  if (globalThis.__psypicJobRuntimeEventPrismaClient !== undefined) {
    return globalThis.__psypicJobRuntimeEventPrismaClient;
  }

  try {
    const prismaClientPackage = "@prisma/client";
    const prismaModule = (await import(
      /* turbopackIgnore: true */ prismaClientPackage
    )) as {
      PrismaClient?: new () => JobRuntimeEventPrismaClient;
    };

    globalThis.__psypicJobRuntimeEventPrismaClient = prismaModule.PrismaClient
      ? new prismaModule.PrismaClient()
      : null;
  } catch {
    globalThis.__psypicJobRuntimeEventPrismaClient = null;
  }

  return globalThis.__psypicJobRuntimeEventPrismaClient;
}

async function ensureDatabaseUser(
  client: JobRuntimeEventPrismaClient,
  userId: string
) {
  if (!client.user) {
    return;
  }

  await client.user.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {}
  });
}

function fromPrismaJobRuntimeEvent(row: JobRuntimeEventRow): JobRuntimeEvent {
  return {
    id: row.id,
    user_id: row.userId,
    task_id: row.taskId,
    version_node_id: row.versionNodeId,
    type: row.type,
    payload: row.payload,
    created_at: row.createdAt.toISOString()
  };
}

function compareEvents(left: JobRuntimeEvent, right: JobRuntimeEvent) {
  return (
    left.created_at.localeCompare(right.created_at) ||
    left.id.localeCompare(right.id)
  );
}

function clampLimit(limit: number | undefined) {
  if (!Number.isInteger(limit)) {
    return 50;
  }

  return Math.min(Math.max(limit ?? 50, 1), 100);
}

function shouldUseDatabaseJobRuntimeEventStore() {
  const mode = process.env.PSYPIC_JOB_RUNTIME_EVENT_STORE?.trim().toLowerCase();

  if (mode === "memory" || mode === "local") {
    return false;
  }

  return (
    mode === "database" ||
    mode === "db" ||
    (process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL))
  );
}

function redactPayload(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveValue(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactPayload);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactPayload(item)])
    );
  }

  return value;
}
