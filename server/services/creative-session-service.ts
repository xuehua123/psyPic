import {
  type CreativeSessionCreateInput,
  type CreativeSessionListInput,
  type CreativeSessionUpdateInput,
  creativeSessionCreateSchema,
  creativeSessionListSchema,
  creativeSessionUpdateSchema
} from "@/lib/validation/workbench";
import { createId } from "@/server/services/key-binding-service";
import {
  assignIfDefined,
  assertWorkbenchProjectForUser,
  assertVersionNodePointerForProject,
  clampWorkbenchLimit,
  fromPrismaWorkbenchProject,
  pageFromRows,
  requireWorkbenchPrismaClient,
  WorkbenchServiceError,
  type PrismaCreativeSessionRow,
  type PrismaWorkbenchClient,
  type WorkbenchPage,
  type WorkbenchProject
} from "@/server/services/workbench-project-service";

export type CreativeSession = {
  id: string;
  project_id: string;
  title: string;
  fork_parent_version_node_id: string | null;
  active_version_node_id: string | null;
  custom_label: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  last_read_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  project?: WorkbenchProject;
};

export async function createCreativeSessionForUser(
  userId: string,
  input: CreativeSessionCreateInput
) {
  const client = await requireWorkbenchPrismaClient();
  const parsed = creativeSessionCreateSchema.parse(input);
  await assertWorkbenchProjectForUser(client, userId, parsed.projectId);
  if (parsed.forkParentVersionNodeId) {
    await assertVersionNodePointerForProject(
      client,
      userId,
      parsed.projectId,
      parsed.forkParentVersionNodeId
    );
  }
  if (parsed.activeVersionNodeId) {
    throw new WorkbenchServiceError(
      "invalid_relation",
      "新会话不能引用已有 active version node"
    );
  }
  const row = await client.creativeSession.create({
    data: {
      id: createId("session"),
      projectId: parsed.projectId,
      title: parsed.title,
      forkParentVersionNodeId: parsed.forkParentVersionNodeId ?? null,
      activeVersionNodeId: parsed.activeVersionNodeId ?? null,
      customLabel: parsed.customLabel ?? null,
      isPinned: parsed.isPinned ?? false,
      isArchived: parsed.isArchived ?? false,
      lastReadAt: parsed.lastReadAt ?? null
    },
    include: { project: true }
  });

  return fromPrismaCreativeSession(row);
}

export async function getCreativeSessionForUser(
  userId: string,
  sessionId: string
) {
  const client = await requireWorkbenchPrismaClient();
  const session = await assertCreativeSessionForUser(client, userId, sessionId);

  return fromPrismaCreativeSession(session);
}

export async function listCreativeSessionsForUser(
  userId: string,
  input: CreativeSessionListInput
): Promise<WorkbenchPage<CreativeSession>> {
  const client = await requireWorkbenchPrismaClient();
  const parsed = creativeSessionListSchema.parse(input);
  await assertWorkbenchProjectForUser(client, userId, parsed.projectId);
  const limit = clampWorkbenchLimit(parsed.limit);
  const rows = await client.creativeSession.findMany({
    where: { projectId: parsed.projectId, deletedAt: null },
    include: { project: true },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
    ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
    take: limit + 1
  });

  return pageFromRows(rows, limit, fromPrismaCreativeSession);
}

export async function updateCreativeSessionForUser(
  userId: string,
  sessionId: string,
  input: CreativeSessionUpdateInput
) {
  const client = await requireWorkbenchPrismaClient();
  const session = await assertCreativeSessionForUser(client, userId, sessionId);
  const parsed = creativeSessionUpdateSchema.parse(input);
  if (parsed.forkParentVersionNodeId) {
    await assertVersionNodePointerForProject(
      client,
      userId,
      session.projectId,
      parsed.forkParentVersionNodeId
    );
  }
  if (parsed.activeVersionNodeId) {
    const activeNode = await assertVersionNodePointerForProject(
      client,
      userId,
      session.projectId,
      parsed.activeVersionNodeId
    );
    if (activeNode.sessionId !== sessionId) {
      throw new WorkbenchServiceError(
        "invalid_relation",
        "active version node 必须属于当前创作会话"
      );
    }
  }
  const data: Record<string, unknown> = {};

  assignIfDefined(data, "title", parsed.title);
  assignIfDefined(data, "forkParentVersionNodeId", parsed.forkParentVersionNodeId);
  assignIfDefined(data, "activeVersionNodeId", parsed.activeVersionNodeId);
  assignIfDefined(data, "customLabel", parsed.customLabel);
  assignIfDefined(data, "isPinned", parsed.isPinned);
  assignIfDefined(data, "isArchived", parsed.isArchived);
  assignIfDefined(data, "lastReadAt", parsed.lastReadAt);

  const row = await client.creativeSession.update({
    where: { id: sessionId },
    data,
    include: { project: true }
  });

  return fromPrismaCreativeSession(row);
}

export async function deleteCreativeSessionForUser(
  userId: string,
  sessionId: string
) {
  const client = await requireWorkbenchPrismaClient();
  await assertCreativeSessionForUser(client, userId, sessionId);
  const deletedAt = new Date();
  const nodes = await client.versionNode.findMany({
    where: { sessionId, deletedAt: null },
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
  const row = await client.creativeSession.update({
    where: { id: sessionId },
    data: { deletedAt, updatedAt: deletedAt },
    include: { project: true }
  });

  return fromPrismaCreativeSession(row);
}

export async function assertCreativeSessionForUser(
  client: PrismaWorkbenchClient,
  userId: string,
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
    throw new WorkbenchServiceError("forbidden", "无权访问该创作会话");
  }

  return row;
}

export function fromPrismaCreativeSession(
  row: PrismaCreativeSessionRow
): CreativeSession {
  return {
    id: row.id,
    project_id: row.projectId,
    title: row.title,
    fork_parent_version_node_id: row.forkParentVersionNodeId,
    active_version_node_id: row.activeVersionNodeId,
    custom_label: row.customLabel,
    is_pinned: row.isPinned,
    is_archived: row.isArchived,
    last_read_at: row.lastReadAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    deleted_at: row.deletedAt?.toISOString() ?? null,
    ...(row.project ? { project: fromPrismaWorkbenchProject(row.project) } : {})
  };
}
