import {
  type VersionNodeCreateInput,
  type VersionNodeListInput,
  type VersionNodeUpdateInput,
  versionNodeCreateSchema,
  versionNodeListSchema,
  versionNodeUpdateSchema
} from "@/lib/validation/workbench";
import { createId } from "@/server/services/key-binding-service";
import {
  assertCreativeSessionForUser,
  fromPrismaCreativeSession
} from "@/server/services/creative-session-service";
import {
  assignIfDefined,
  clampWorkbenchLimit,
  fromPrismaWorkbenchProject,
  pageFromRows,
  requireWorkbenchPrismaClient,
  WorkbenchServiceError,
  type PrismaVersionNodeRow,
  type PrismaWorkbenchClient,
  type WorkbenchPage,
  type WorkbenchProject
} from "@/server/services/workbench-project-service";
import type { CreativeSession } from "@/server/services/creative-session-service";

export type VersionNode = {
  id: string;
  project_id: string;
  session_id: string;
  parent_version_node_id: string | null;
  prompt_snapshot: string;
  params_snapshot: unknown;
  source_asset_ids: unknown;
  output_asset_ids: unknown;
  board_document_id: string | null;
  board_snapshot: unknown;
  board_export_asset_id: string | null;
  branch_label: string | null;
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "canceled"
    | "timed_out"
    | "partial_image";
  created_at: string;
  project?: WorkbenchProject;
  session?: CreativeSession;
};

export async function createVersionNodeForUser(
  userId: string,
  input: VersionNodeCreateInput
) {
  const client = await requireWorkbenchPrismaClient();
  const parsed = versionNodeCreateSchema.parse(input);
  const session = await assertCreativeSessionForUser(
    client,
    userId,
    parsed.sessionId
  );

  if (session.projectId !== parsed.projectId) {
    throw new WorkbenchServiceError(
      "invalid_relation",
      "版本节点的项目和会话不匹配"
    );
  }

  if (parsed.parentVersionNodeId) {
    const parent = await assertVersionNodeForUser(
      client,
      userId,
      parsed.parentVersionNodeId
    );
    if (parent.projectId !== parsed.projectId || parent.sessionId !== parsed.sessionId) {
      throw new WorkbenchServiceError(
        "invalid_relation",
        "父版本节点必须属于同一项目和会话"
      );
    }
  }

  const row = await client.versionNode.create({
    data: {
      id: createId("ver"),
      projectId: parsed.projectId,
      sessionId: parsed.sessionId,
      parentVersionNodeId: parsed.parentVersionNodeId ?? null,
      promptSnapshot: parsed.promptSnapshot,
      paramsSnapshot: parsed.paramsSnapshot,
      sourceAssetIds: parsed.sourceAssetIds,
      outputAssetIds: parsed.outputAssetIds,
      boardDocumentId: parsed.boardDocumentId ?? null,
      boardSnapshot: parsed.boardSnapshot ?? null,
      boardExportAssetId: parsed.boardExportAssetId ?? null,
      branchLabel: parsed.branchLabel ?? null,
      status: parsed.status
    },
    include: { project: true, session: { include: { project: true } } }
  });

  return fromPrismaVersionNode(row);
}

export async function getVersionNodeForUser(userId: string, nodeId: string) {
  const client = await requireWorkbenchPrismaClient();
  const node = await assertVersionNodeForUser(client, userId, nodeId);

  return fromPrismaVersionNode(node);
}

export async function listVersionNodesForUser(
  userId: string,
  input: VersionNodeListInput
): Promise<WorkbenchPage<VersionNode>> {
  const client = await requireWorkbenchPrismaClient();
  const parsed = versionNodeListSchema.parse(input);
  await assertCreativeSessionForUser(client, userId, parsed.sessionId);
  const limit = clampWorkbenchLimit(parsed.limit);
  const rows = await client.versionNode.findMany({
    where: { sessionId: parsed.sessionId },
    include: { project: true, session: { include: { project: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
    take: limit + 1
  });

  return pageFromRows(rows, limit, fromPrismaVersionNode);
}

export async function updateVersionNodeForUser(
  userId: string,
  nodeId: string,
  input: VersionNodeUpdateInput
) {
  const client = await requireWorkbenchPrismaClient();
  await assertVersionNodeForUser(client, userId, nodeId);
  const parsed = versionNodeUpdateSchema.parse(input);
  const data: Record<string, unknown> = {};

  assignIfDefined(data, "status", parsed.status);
  assignIfDefined(data, "outputAssetIds", parsed.outputAssetIds);
  assignIfDefined(data, "branchLabel", parsed.branchLabel);
  assignIfDefined(data, "boardDocumentId", parsed.boardDocumentId);
  assignIfDefined(data, "boardSnapshot", parsed.boardSnapshot);
  assignIfDefined(data, "boardExportAssetId", parsed.boardExportAssetId);

  const row = await client.versionNode.update({
    where: { id: nodeId },
    data,
    include: { project: true, session: { include: { project: true } } }
  });

  return fromPrismaVersionNode(row);
}

export async function deleteVersionNodeForUser(userId: string, nodeId: string) {
  const client = await requireWorkbenchPrismaClient();
  await assertVersionNodeForUser(client, userId, nodeId);
  if (!client.versionNode.delete) {
    throw new WorkbenchServiceError("unavailable", "版本节点删除不可用");
  }
  const row = await client.versionNode.delete({
    where: { id: nodeId },
    include: { project: true, session: { include: { project: true } } }
  });

  return fromPrismaVersionNode(row);
}

export async function assertVersionNodeForUser(
  client: PrismaWorkbenchClient,
  userId: string,
  nodeId: string
) {
  const row = await client.versionNode.findUnique({
    where: { id: nodeId },
    include: { project: true, session: { include: { project: true } } }
  });

  if (!row) {
    throw new WorkbenchServiceError("not_found", "版本节点不存在");
  }

  if (!row.project) {
    throw new WorkbenchServiceError("not_found", "版本节点所属项目不存在");
  }

  if (row.project.userId !== userId) {
    throw new WorkbenchServiceError("forbidden", "无权访问该版本节点");
  }

  return row;
}

export function fromPrismaVersionNode(row: PrismaVersionNodeRow): VersionNode {
  return {
    id: row.id,
    project_id: row.projectId,
    session_id: row.sessionId,
    parent_version_node_id: row.parentVersionNodeId,
    prompt_snapshot: row.promptSnapshot,
    params_snapshot: row.paramsSnapshot,
    source_asset_ids: row.sourceAssetIds,
    output_asset_ids: row.outputAssetIds,
    board_document_id: row.boardDocumentId,
    board_snapshot: row.boardSnapshot,
    board_export_asset_id: row.boardExportAssetId,
    branch_label: row.branchLabel,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    ...(row.project ? { project: fromPrismaWorkbenchProject(row.project) } : {}),
    ...(row.session ? { session: fromPrismaCreativeSession(row.session) } : {})
  };
}
