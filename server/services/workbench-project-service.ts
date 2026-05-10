import {
  type WorkbenchListInput,
  type WorkbenchProjectCreateInput,
  type WorkbenchProjectUpdateInput,
  workbenchListSchema,
  workbenchProjectCreateSchema,
  workbenchProjectUpdateSchema
} from "@/lib/validation/workbench";
import { createId } from "@/server/services/key-binding-service";
import { createPostgresPrismaClient } from "@/server/services/prisma-client-factory";

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
  deleted_at: string | null;
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
  deletedAt: Date | null;
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
  deletedAt: Date | null;
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
  updatedAt: Date;
  deletedAt: Date | null;
  project?: PrismaWorkbenchProjectRow | null;
  session?: PrismaCreativeSessionRow | null;
};

export type PrismaWorkbenchSyncMutationRow = {
  id: string;
  userId: string;
  clientMutationId: string;
  operation: string;
  targetType: string;
  targetId: string;
  result: unknown;
  createdAt: Date;
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
    updateMany?(input: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
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
    updateMany?(input: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
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
  workbenchSyncMutation: {
    create(input: {
      data: Record<string, unknown>;
    }): Promise<PrismaWorkbenchSyncMutationRow>;
    findUnique(input: {
      where: {
        userId_clientMutationId: {
          userId: string;
          clientMutationId: string;
        };
      };
    }): Promise<PrismaWorkbenchSyncMutationRow | null>;
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
  if (parsed.activeSessionId) {
    throw new WorkbenchServiceError(
      "invalid_relation",
      "新项目不能引用已有创作会话"
    );
  }
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
    where: { userId, deletedAt: null },
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
  if (parsed.activeSessionId) {
    await assertCreativeSessionPointerForProject(
      client,
      userId,
      projectId,
      parsed.activeSessionId
    );
  }
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
  if (!client.workbenchSyncMutation) {
    const row = await client.workbenchProject.delete({
      where: { id: projectId }
    });

    return fromPrismaWorkbenchProject(row);
  }

  const deletedAt = new Date();
  await tombstoneWorkbenchProjectChildren(client, projectId, deletedAt);
  const row = await client.workbenchProject.update({
    where: { id: projectId },
    data: { deletedAt, updatedAt: deletedAt }
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

  if (!row || row.deletedAt) {
    throw new WorkbenchServiceError("not_found", "工作台项目不存在");
  }

  if (row.userId !== userId) {
    throw new WorkbenchServiceError("forbidden", "无权访问该工作台项目");
  }

  return row;
}

export async function assertCreativeSessionPointerForProject(
  client: PrismaWorkbenchClient,
  userId: string,
  projectId: string,
  sessionId: string
) {
  const row = await client.creativeSession.findUnique({
    where: { id: sessionId },
    include: { project: true }
  });

  if (!row || row.deletedAt) {
    throw new WorkbenchServiceError("not_found", "创作会话不存在");
  }

  if (!row.project || row.project.deletedAt) {
    throw new WorkbenchServiceError("not_found", "创作会话所属项目不存在");
  }

  if (row.project.userId !== userId) {
    throw new WorkbenchServiceError("forbidden", "无权引用该创作会话");
  }

  if (row.projectId !== projectId) {
    throw new WorkbenchServiceError(
      "invalid_relation",
      "创作会话必须属于当前工作台项目"
    );
  }

  return row;
}

export async function assertVersionNodePointerForProject(
  client: PrismaWorkbenchClient,
  userId: string,
  projectId: string,
  nodeId: string
) {
  const row = await client.versionNode.findUnique({
    where: { id: nodeId },
    include: { project: true, session: { include: { project: true } } }
  });

  if (!row || row.deletedAt) {
    throw new WorkbenchServiceError("not_found", "版本节点不存在");
  }

  if (!row.project || row.project.deletedAt) {
    throw new WorkbenchServiceError("not_found", "版本节点所属项目不存在");
  }

  if (row.project.userId !== userId) {
    throw new WorkbenchServiceError("forbidden", "无权引用该版本节点");
  }

  if (row.projectId !== projectId) {
    throw new WorkbenchServiceError(
      "invalid_relation",
      "版本节点必须属于当前工作台项目"
    );
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
      PrismaClient?: new (options: { adapter: unknown }) => PrismaWorkbenchClient;
    };

    globalThis.__psypicWorkbenchPrismaClient = prismaModule.PrismaClient
      ? await createPostgresPrismaClient(prismaModule.PrismaClient)
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
    updated_at: row.updatedAt.toISOString(),
    deleted_at: row.deletedAt?.toISOString() ?? null
  };
}

export async function tombstoneWorkbenchProjectChildren(
  client: PrismaWorkbenchClient,
  projectId: string,
  deletedAt: Date
) {
  await Promise.all([
    updateCreativeSessionsMany(client, { projectId, deletedAt: null }, deletedAt),
    tombstoneVersionNodes(client, { projectId, deletedAt: null }, deletedAt)
  ]);
}

export async function tombstoneVersionNodes(
  client: PrismaWorkbenchClient,
  where: Record<string, unknown>,
  deletedAt: Date
) {
  if (client.versionNode.updateMany) {
    await client.versionNode.updateMany({
      where,
      data: { deletedAt, updatedAt: deletedAt }
    });
    return;
  }

  const nodes = await client.versionNode.findMany({
    where,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: 1000
  });

  await Promise.all(
    nodes.map((node) =>
      client.versionNode.update({
        where: { id: node.id },
        data: { deletedAt, updatedAt: deletedAt }
      })
    )
  );
}

async function updateCreativeSessionsMany(
  client: PrismaWorkbenchClient,
  where: Record<string, unknown>,
  deletedAt: Date
) {
  if (client.creativeSession.updateMany) {
    await client.creativeSession.updateMany({
      where,
      data: { deletedAt, updatedAt: deletedAt }
    });
    return;
  }

  const sessions = await client.creativeSession.findMany({
    where,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: 1000
  });

  await Promise.all(
    sessions.map((session) =>
      client.creativeSession.update({
        where: { id: session.id },
        data: { deletedAt, updatedAt: deletedAt }
      })
    )
  );
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
