import {
  type WorkbenchListInput,
  type WorkbenchProjectCreateInput,
  type WorkbenchProjectUpdateInput,
  workbenchListSchema,
  workbenchProjectCreateSchema,
  workbenchProjectUpdateSchema
} from "@/lib/validation/workbench";
import { createId } from "@/server/services/key-binding-service";

export type WorkbenchServiceErrorCode =
  | "not_found"
  | "forbidden"
  | "unavailable"
  | "invalid_relation";

export class WorkbenchServiceError extends Error {
  code: WorkbenchServiceErrorCode;

  constructor(code: WorkbenchServiceErrorCode, message: string) {
    super(message);
    this.name = "WorkbenchServiceError";
    this.code = code;
  }
}

export type WorkbenchProject = {
  id: string;
  user_id: string;
  title: string;
  sort_order: number;
  collapsed: boolean;
  active_session_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkbenchPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type PrismaWorkbenchProjectRow = {
  id: string;
  userId: string;
  title: string;
  sortOrder: number;
  collapsed: boolean;
  activeSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PrismaCreativeSessionRow = {
  id: string;
  projectId: string;
  title: string;
  forkParentVersionNodeId: string | null;
  activeVersionNodeId: string | null;
  customLabel: string | null;
  isPinned: boolean;
  isArchived: boolean;
  lastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project?: PrismaWorkbenchProjectRow | null;
};

export type PrismaVersionNodeRow = {
  id: string;
  projectId: string;
  sessionId: string;
  parentVersionNodeId: string | null;
  promptSnapshot: string;
  paramsSnapshot: unknown;
  sourceAssetIds: unknown;
  outputAssetIds: unknown;
  boardDocumentId: string | null;
  boardSnapshot: unknown;
  boardExportAssetId: string | null;
  branchLabel: string | null;
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "canceled"
    | "timed_out"
    | "partial_image";
  createdAt: Date;
  project?: PrismaWorkbenchProjectRow | null;
  session?: PrismaCreativeSessionRow | null;
};

type FindManyInput = {
  where: Record<string, unknown>;
  orderBy: Array<Record<string, "asc" | "desc">>;
  cursor?: { id: string };
  skip?: number;
  take: number;
  include?: Record<string, unknown>;
};

export type PrismaWorkbenchClient = {
  workbenchProject: {
    create(input: {
      data: Record<string, unknown>;
    }): Promise<PrismaWorkbenchProjectRow>;
    findUnique(input: {
      where: { id: string };
    }): Promise<PrismaWorkbenchProjectRow | null>;
    findMany(input: FindManyInput): Promise<PrismaWorkbenchProjectRow[]>;
    update(input: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<PrismaWorkbenchProjectRow>;
    delete(input: {
      where: { id: string };
    }): Promise<PrismaWorkbenchProjectRow>;
  };
  creativeSession: {
    create(input: {
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaCreativeSessionRow>;
    findUnique(input: {
      where: { id: string };
      include?: Record<string, unknown>;
    }): Promise<PrismaCreativeSessionRow | null>;
    findMany(input: FindManyInput): Promise<PrismaCreativeSessionRow[]>;
    update(input: {
      where: { id: string };
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaCreativeSessionRow>;
    delete(input: {
      where: { id: string };
      include?: Record<string, unknown>;
    }): Promise<PrismaCreativeSessionRow>;
  };
  versionNode: {
    create(input: {
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaVersionNodeRow>;
    findUnique(input: {
      where: { id: string };
      include?: Record<string, unknown>;
    }): Promise<PrismaVersionNodeRow | null>;
    findMany(input: FindManyInput): Promise<PrismaVersionNodeRow[]>;
    update(input: {
      where: { id: string };
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaVersionNodeRow>;
    delete?(input: {
      where: { id: string };
      include?: Record<string, unknown>;
    }): Promise<PrismaVersionNodeRow>;
  };
};

declare global {
  var __psypicWorkbenchPrismaClient: PrismaWorkbenchClient | null | undefined;
}

export async function createWorkbenchProjectForUser(
  userId: string,
  input: WorkbenchProjectCreateInput
) {
  const client = await requireWorkbenchPrismaClient();
  const parsed = workbenchProjectCreateSchema.parse(input);
  const row = await client.workbenchProject.create({
    data: {
      id: createId("proj"),
      userId,
      title: parsed.title,
      sortOrder: parsed.sortOrder ?? 0,
      collapsed: parsed.collapsed ?? false,
      activeSessionId: parsed.activeSessionId ?? null
    }
  });

  return fromPrismaWorkbenchProject(row);
}

export async function getWorkbenchProjectForUser(
  userId: string,
  projectId: string
) {
  const client = await requireWorkbenchPrismaClient();
  const project = await assertWorkbenchProjectForUser(client, userId, projectId);

  return fromPrismaWorkbenchProject(project);
}

export async function listWorkbenchProjectsForUser(
  userId: string,
  input?: WorkbenchListInput
): Promise<WorkbenchPage<WorkbenchProject>> {
  const client = await requireWorkbenchPrismaClient();
  const parsed = workbenchListSchema.parse(input ?? {});
  const limit = clampWorkbenchLimit(parsed.limit);
  const rows = await client.workbenchProject.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
    ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
    take: limit + 1
  });

  return pageFromRows(rows, limit, fromPrismaWorkbenchProject);
}

export async function updateWorkbenchProjectForUser(
  userId: string,
  projectId: string,
  input: WorkbenchProjectUpdateInput
) {
  const client = await requireWorkbenchPrismaClient();
  await assertWorkbenchProjectForUser(client, userId, projectId);
  const parsed = workbenchProjectUpdateSchema.parse(input);
  const data: Record<string, unknown> = {};

  assignIfDefined(data, "title", parsed.title);
  assignIfDefined(data, "sortOrder", parsed.sortOrder);
  assignIfDefined(data, "collapsed", parsed.collapsed);
  assignIfDefined(data, "activeSessionId", parsed.activeSessionId);

  const row = await client.workbenchProject.update({
    where: { id: projectId },
    data
  });

  return fromPrismaWorkbenchProject(row);
}

export async function deleteWorkbenchProjectForUser(
  userId: string,
  projectId: string
) {
  const client = await requireWorkbenchPrismaClient();
  await assertWorkbenchProjectForUser(client, userId, projectId);
  const row = await client.workbenchProject.delete({
    where: { id: projectId }
  });

  return fromPrismaWorkbenchProject(row);
}

export async function assertWorkbenchProjectForUser(
  client: PrismaWorkbenchClient,
  userId: string,
  projectId: string
) {
  const row = await client.workbenchProject.findUnique({
    where: { id: projectId }
  });

  if (!row) {
    throw new WorkbenchServiceError("not_found", "工作台项目不存在");
  }

  if (row.userId !== userId) {
    throw new WorkbenchServiceError("forbidden", "无权访问该工作台项目");
  }

  return row;
}

export async function requireWorkbenchPrismaClient() {
  const client = await getWorkbenchPrismaClient();
  if (!client) {
    throw new WorkbenchServiceError("unavailable", "工作台数据库不可用");
  }

  return client;
}

export async function getWorkbenchPrismaClient() {
  if (globalThis.__psypicWorkbenchPrismaClient !== undefined) {
    return globalThis.__psypicWorkbenchPrismaClient;
  }

  if (!shouldUseDatabaseWorkbenchStore()) {
    globalThis.__psypicWorkbenchPrismaClient = null;
    return null;
  }

  try {
    const prismaClientPackage = "@prisma/client";
    const prismaModule = (await import(
      /* turbopackIgnore: true */ prismaClientPackage
    )) as {
      PrismaClient?: new () => PrismaWorkbenchClient;
    };

    globalThis.__psypicWorkbenchPrismaClient = prismaModule.PrismaClient
      ? new prismaModule.PrismaClient()
      : null;
  } catch {
    globalThis.__psypicWorkbenchPrismaClient = null;
  }

  return globalThis.__psypicWorkbenchPrismaClient;
}

export function fromPrismaWorkbenchProject(
  row: PrismaWorkbenchProjectRow
): WorkbenchProject {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    sort_order: row.sortOrder,
    collapsed: row.collapsed,
    active_session_id: row.activeSessionId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  };
}

export function pageFromRows<Row, Output>(
  rows: Row[],
  limit: number,
  serialize: (row: Row) => Output
): WorkbenchPage<Output> {
  const items = rows.slice(0, limit).map(serialize);
  const nextCursor = rows.length > limit ? readId(rows[limit - 1]) : null;

  return {
    items,
    nextCursor
  };
}

export function clampWorkbenchLimit(limit: number | undefined) {
  return Math.min(Math.max(limit ?? 30, 1), 50);
}

export function assignIfDefined(
  target: Record<string, unknown>,
  key: string,
  value: unknown
) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function shouldUseDatabaseWorkbenchStore() {
  const mode = process.env.PSYPIC_WORKBENCH_PROJECTS_STORE?.trim().toLowerCase();

  if (mode === "indexeddb" || mode === "local") {
    return false;
  }

  return mode === "database" || mode === "db" || Boolean(process.env.DATABASE_URL);
}

function readId(row: unknown) {
  if (row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string") {
    return (row as { id: string }).id;
  }

  return null;
}
