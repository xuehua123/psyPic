import {
  type WorkbenchSyncOperationInput,
  type WorkbenchSyncPullInput,
  type WorkbenchSyncPushInput,
  workbenchSyncPullSchema,
  workbenchSyncPushSchema
} from "@/lib/validation/workbench";
import { createId } from "@/server/services/key-binding-service";
import {
  assertCreativeSessionForUser,
  fromPrismaCreativeSession
} from "@/server/services/creative-session-service";
import {
  assertCreativeSessionPointerForProject,
  assertVersionNodePointerForProject,
  assertWorkbenchProjectForUser,
  fromPrismaWorkbenchProject,
  requireWorkbenchPrismaClient,
  tombstoneWorkbenchProjectChildren,
  WorkbenchServiceError,
  type PrismaCreativeSessionRow,
  type PrismaVersionNodeRow,
  type PrismaWorkbenchClient,
  type PrismaWorkbenchProjectRow
} from "@/server/services/workbench-project-service";
import { fromPrismaVersionNode } from "@/server/services/version-node-service";

export const MAX_WORKBENCH_SYNC_OPERATIONS = 50;
export const MAX_WORKBENCH_SYNC_PAYLOAD_BYTES = 256 * 1024;

type SyncRecord =
  | ReturnType<typeof fromPrismaWorkbenchProject>
  | ReturnType<typeof fromPrismaCreativeSession>
  | ReturnType<typeof fromPrismaVersionNode>;

type SyncResult = {
  client_mutation_id: string;
  entity: WorkbenchSyncOperationInput["entity"];
  action: WorkbenchSyncOperationInput["action"];
  id: string;
  status: "applied" | "replayed" | "conflict" | "error";
  record?: SyncRecord;
  server_record?: SyncRecord;
  code?: string;
  message?: string;
};

export async function pullWorkbenchChangesForUser(
  userId: string,
  input?: WorkbenchSyncPullInput
) {
  const client = await requireWorkbenchPrismaClient();
  const parsed = workbenchSyncPullSchema.parse(input ?? {});
  const updatedAtFilter = parsed.updatedSince
    ? { updatedAt: { gt: parsed.updatedSince } }
    : {};

  const [projects, sessions, versionNodes] = await Promise.all([
    client.workbenchProject.findMany({
      where: { userId, ...updatedAtFilter },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: 1000
    }),
    client.creativeSession.findMany({
      where: { project: { is: { userId } }, ...updatedAtFilter },
      include: { project: true },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: 1000
    }),
    client.versionNode.findMany({
      where: { project: { is: { userId } }, ...updatedAtFilter },
      include: { project: true, session: { include: { project: true } } },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: 1000
    })
  ]);

  return {
    projects: projects.map(fromPrismaWorkbenchProject),
    sessions: sessions.map(fromPrismaCreativeSession),
    version_nodes: versionNodes.map(fromPrismaVersionNode)
  };
}

export async function pushWorkbenchChangesForUser(
  userId: string,
  input: WorkbenchSyncPushInput
) {
  const client = await requireWorkbenchPrismaClient();
  const parsed = workbenchSyncPushSchema.parse(input);
  const results: SyncResult[] = [];

  for (const operation of parsed.operations) {
    results.push(await applyOperation(client, userId, operation));
  }

  const pulled = parsed.pull
    ? await pullWorkbenchChangesForUser(userId, parsed.pull)
    : undefined;

  return {
    push_results: results,
    ...(pulled ? { pulled } : {})
  };
}

async function applyOperation(
  client: PrismaWorkbenchClient,
  userId: string,
  operation: WorkbenchSyncOperationInput
): Promise<SyncResult> {
  const replayed = await client.workbenchSyncMutation.findUnique({
    where: {
      userId_clientMutationId: {
        userId,
        clientMutationId: operation.clientMutationId
      }
    }
  });

  if (replayed) {
    return replayResult(replayed.result, operation);
  }

  const result = await runOperation(client, userId, operation).catch(
    (error: unknown): SyncResult => toErrorResult(error, operation)
  );

  await client.workbenchSyncMutation.create({
    data: {
      id: createId("sync"),
      userId,
      clientMutationId: operation.clientMutationId,
      operation: `${operation.entity}:${operation.action}`,
      targetType: operation.entity,
      targetId: readOptionalId(operation.data) ?? "unknown",
      result
    }
  });

  return result;
}

async function runOperation(
  client: PrismaWorkbenchClient,
  userId: string,
  operation: WorkbenchSyncOperationInput
): Promise<SyncResult> {
  if (operation.action === "delete") {
    return deleteRecord(client, userId, operation);
  }

  if (operation.entity === "project") {
    return upsertProject(client, userId, operation);
  }

  if (operation.entity === "session") {
    return upsertSession(client, userId, operation);
  }

  return upsertVersionNode(client, userId, operation);
}

async function upsertProject(
  client: PrismaWorkbenchClient,
  userId: string,
  operation: WorkbenchSyncOperationInput
): Promise<SyncResult> {
  const id = readRequiredId(operation.data);
  const incomingUpdatedAt = readUpdatedAt(operation.data);
  const current = await client.workbenchProject.findUnique({ where: { id } });
  const conflict = checkProjectConflict(current, userId, incomingUpdatedAt);
  if (conflict) return conflictResult(operation, fromPrismaWorkbenchProject(conflict));
  const activeSessionId = readNullableString(operation.data, "active_session_id");
  if (activeSessionId) {
    await assertCreativeSessionPointerForProject(client, userId, id, activeSessionId);
  }

  const data = {
    id,
    userId,
    title: readString(operation.data, "title", "Untitled"),
    sortOrder: readNumber(operation.data, "sort_order", 0),
    collapsed: readBoolean(operation.data, "collapsed", false),
    activeSessionId,
    createdAt: readDate(operation.data.created_at) ?? incomingUpdatedAt,
    updatedAt: incomingUpdatedAt,
    deletedAt: null
  };

  const row = current
    ? await client.workbenchProject.update({ where: { id }, data })
    : await client.workbenchProject.create({ data });

  return appliedResult(operation, fromPrismaWorkbenchProject(row));
}

async function upsertSession(
  client: PrismaWorkbenchClient,
  userId: string,
  operation: WorkbenchSyncOperationInput
): Promise<SyncResult> {
  const id = readRequiredId(operation.data);
  const projectId = readString(operation.data, "project_id");
  const incomingUpdatedAt = readUpdatedAt(operation.data);
  await assertWorkbenchProjectForUser(client, userId, projectId);
  const current = await client.creativeSession.findUnique({
    where: { id },
    include: { project: true }
  });
  const conflict = checkSessionConflict(current, userId, incomingUpdatedAt);
  if (conflict) return conflictResult(operation, fromPrismaCreativeSession(conflict));
  const forkParentVersionNodeId = readNullableString(
    operation.data,
    "fork_parent_version_node_id"
  );
  const activeVersionNodeId = readNullableString(
    operation.data,
    "active_version_node_id"
  );
  if (forkParentVersionNodeId) {
    await assertVersionNodePointerForProject(
      client,
      userId,
      projectId,
      forkParentVersionNodeId
    );
  }
  if (activeVersionNodeId) {
    const activeNode = await assertVersionNodePointerForProject(
      client,
      userId,
      projectId,
      activeVersionNodeId
    );
    if (activeNode.sessionId !== id) {
      throw new WorkbenchServiceError(
        "invalid_relation",
        "active version node 必须属于当前创作会话"
      );
    }
  }

  const data = {
    id,
    projectId,
    title: readString(operation.data, "title", "Untitled"),
    forkParentVersionNodeId,
    activeVersionNodeId,
    customLabel: readNullableString(operation.data, "custom_label"),
    isPinned: readBoolean(operation.data, "is_pinned", false),
    isArchived: readBoolean(operation.data, "is_archived", false),
    lastReadAt: readDate(operation.data.last_read_at),
    createdAt: readDate(operation.data.created_at) ?? incomingUpdatedAt,
    updatedAt: incomingUpdatedAt,
    deletedAt: null
  };

  const row = current
    ? await client.creativeSession.update({
        where: { id },
        data,
        include: { project: true }
      })
    : await client.creativeSession.create({
        data,
        include: { project: true }
      });

  return appliedResult(operation, fromPrismaCreativeSession(row));
}

async function upsertVersionNode(
  client: PrismaWorkbenchClient,
  userId: string,
  operation: WorkbenchSyncOperationInput
): Promise<SyncResult> {
  const id = readRequiredId(operation.data);
  const projectId = readString(operation.data, "project_id");
  const sessionId = readString(operation.data, "session_id");
  const incomingUpdatedAt = readUpdatedAt(operation.data);
  const session = await assertCreativeSessionForUser(client, userId, sessionId);
  if (session.projectId !== projectId) {
    throw new WorkbenchServiceError(
      "invalid_relation",
      "版本节点的项目和会话不匹配"
    );
  }
  const current = await client.versionNode.findUnique({
    where: { id },
    include: { project: true, session: { include: { project: true } } }
  });
  const conflict = checkVersionNodeConflict(current, userId, incomingUpdatedAt);
  if (conflict) return conflictResult(operation, fromPrismaVersionNode(conflict));
  const parentVersionNodeId = readNullableString(
    operation.data,
    "parent_version_node_id"
  );
  if (parentVersionNodeId) {
    const parent = await assertVersionNodePointerForProject(
      client,
      userId,
      projectId,
      parentVersionNodeId
    );
    if (parent.sessionId !== sessionId) {
      throw new WorkbenchServiceError(
        "invalid_relation",
        "父版本节点必须属于同一项目和会话"
      );
    }
  }

  const data = {
    id,
    projectId,
    sessionId,
    parentVersionNodeId,
    promptSnapshot: readString(operation.data, "prompt_snapshot", ""),
    paramsSnapshot: operation.data.params_snapshot ?? {},
    sourceAssetIds: readArray(operation.data, "source_asset_ids"),
    outputAssetIds: readArray(operation.data, "output_asset_ids"),
    boardDocumentId: readNullableString(operation.data, "board_document_id"),
    boardSnapshot: operation.data.board_snapshot ?? null,
    boardExportAssetId: readNullableString(
      operation.data,
      "board_export_asset_id"
    ),
    branchLabel: readNullableString(operation.data, "branch_label"),
    status: readString(operation.data, "status", "queued"),
    createdAt: readDate(operation.data.created_at) ?? incomingUpdatedAt,
    updatedAt: incomingUpdatedAt,
    deletedAt: null
  };

  const row = current
    ? await client.versionNode.update({
        where: { id },
        data,
        include: { project: true, session: { include: { project: true } } }
      })
    : await client.versionNode.create({
        data,
        include: { project: true, session: { include: { project: true } } }
      });

  return appliedResult(operation, fromPrismaVersionNode(row));
}

async function deleteRecord(
  client: PrismaWorkbenchClient,
  userId: string,
  operation: WorkbenchSyncOperationInput
): Promise<SyncResult> {
  if (operation.entity === "project") {
    const project = await assertWorkbenchProjectForUser(
      client,
      userId,
      readRequiredId(operation.data)
    );
    return deleteProject(client, operation, project);
  }

  if (operation.entity === "session") {
    const session = await assertCreativeSessionForUser(
      client,
      userId,
      readRequiredId(operation.data)
    );
    return deleteSession(client, operation, session);
  }

  const node = await client.versionNode.findUnique({
    where: { id: readRequiredId(operation.data) },
    include: { project: true, session: { include: { project: true } } }
  });
  const conflict = checkVersionNodeConflict(node, userId, readUpdatedAt(operation.data));
  if (!node) throw new WorkbenchServiceError("not_found", "版本节点不存在");
  if (!node.project || node.project.userId !== userId) {
    throw new WorkbenchServiceError("forbidden", "无权访问该版本节点");
  }
  if (conflict) return conflictResult(operation, fromPrismaVersionNode(conflict));

  const deletedAt = readUpdatedAt(operation.data);
  const row = await client.versionNode.update({
    where: { id: node.id },
    data: { deletedAt, updatedAt: deletedAt },
    include: { project: true, session: { include: { project: true } } }
  });

  return appliedResult(operation, fromPrismaVersionNode(row));
}

async function deleteProject(
  client: PrismaWorkbenchClient,
  operation: WorkbenchSyncOperationInput,
  project: PrismaWorkbenchProjectRow
): Promise<SyncResult> {
  const deletedAt = readUpdatedAt(operation.data);
  if (project.updatedAt > deletedAt) {
    return conflictResult(operation, fromPrismaWorkbenchProject(project));
  }

  await tombstoneWorkbenchProjectChildren(client, project.id, deletedAt);
  const row = await client.workbenchProject.update({
    where: { id: project.id },
    data: { deletedAt, updatedAt: deletedAt }
  });

  return appliedResult(operation, fromPrismaWorkbenchProject(row));
}

async function deleteSession(
  client: PrismaWorkbenchClient,
  operation: WorkbenchSyncOperationInput,
  session: PrismaCreativeSessionRow
): Promise<SyncResult> {
  const deletedAt = readUpdatedAt(operation.data);
  if (session.updatedAt > deletedAt) {
    return conflictResult(operation, fromPrismaCreativeSession(session));
  }

  const nodes = await client.versionNode.findMany({
    where: { sessionId: session.id, deletedAt: null },
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
    where: { id: session.id },
    data: { deletedAt, updatedAt: deletedAt },
    include: { project: true }
  });

  return appliedResult(operation, fromPrismaCreativeSession(row));
}

function checkProjectConflict(
  row: PrismaWorkbenchProjectRow | null,
  userId: string,
  incomingUpdatedAt: Date
) {
  if (!row) return null;
  if (row.userId !== userId) {
    throw new WorkbenchServiceError("forbidden", "无权访问该工作台项目");
  }
  return row.updatedAt > incomingUpdatedAt ? row : null;
}

function checkSessionConflict(
  row: PrismaCreativeSessionRow | null,
  userId: string,
  incomingUpdatedAt: Date
) {
  if (!row) return null;
  if (!row.project || row.project.userId !== userId) {
    throw new WorkbenchServiceError("forbidden", "无权访问该创作会话");
  }
  return row.updatedAt > incomingUpdatedAt ? row : null;
}

function checkVersionNodeConflict(
  row: PrismaVersionNodeRow | null,
  userId: string,
  incomingUpdatedAt: Date
) {
  if (!row) return null;
  if (!row.project || row.project.userId !== userId) {
    throw new WorkbenchServiceError("forbidden", "无权访问该版本节点");
  }
  return row.updatedAt > incomingUpdatedAt ? row : null;
}

function appliedResult(
  operation: WorkbenchSyncOperationInput,
  record: SyncRecord
): SyncResult {
  return {
    client_mutation_id: operation.clientMutationId,
    entity: operation.entity,
    action: operation.action,
    id: readOptionalId(operation.data) ?? "unknown",
    status: "applied",
    record
  };
}

function conflictResult(
  operation: WorkbenchSyncOperationInput,
  serverRecord: SyncRecord
): SyncResult {
  return {
    client_mutation_id: operation.clientMutationId,
    entity: operation.entity,
    action: operation.action,
    id: readOptionalId(operation.data) ?? "unknown",
    status: "conflict",
    code: "conflict",
    message: "服务端记录更新，客户端 mutation 已过期",
    server_record: serverRecord
  };
}

function toErrorResult(
  error: unknown,
  operation: WorkbenchSyncOperationInput
): SyncResult {
  if (error instanceof WorkbenchServiceError) {
    return {
      client_mutation_id: operation.clientMutationId,
      entity: operation.entity,
      action: operation.action,
      id: readOptionalId(operation.data) ?? "unknown",
      status: "error",
      code: error.code,
      message: error.message
    };
  }

  return {
    client_mutation_id: operation.clientMutationId,
    entity: operation.entity,
    action: operation.action,
    id: readOptionalId(operation.data) ?? "unknown",
    status: "error",
    code: "invalid_parameter",
    message: error instanceof Error ? error.message : "sync operation 参数错误"
  };
}

function replayResult(
  result: unknown,
  operation: WorkbenchSyncOperationInput
): SyncResult {
  if (result && typeof result === "object") {
    return {
      ...(result as SyncResult),
      client_mutation_id: operation.clientMutationId,
      id: readOptionalId(operation.data) ?? (result as SyncResult).id,
      status: "replayed"
    };
  }

  return {
    client_mutation_id: operation.clientMutationId,
    entity: operation.entity,
    action: operation.action,
    id: readOptionalId(operation.data) ?? "unknown",
    status: "replayed"
  };
}

function readRequiredId(data: Record<string, unknown>) {
  return readString(data, "id");
}

function readOptionalId(data: Record<string, unknown>) {
  const value = data.id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readString(
  data: Record<string, unknown>,
  key: string,
  fallback?: string
) {
  const value = data[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new WorkbenchServiceError("invalid_relation", `${key} 不能为空`);
}

function readNullableString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(
  data: Record<string, unknown>,
  key: string,
  fallback: number
) {
  return typeof data[key] === "number" ? data[key] : fallback;
}

function readBoolean(
  data: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  return typeof data[key] === "boolean" ? data[key] : fallback;
}

function readArray(data: Record<string, unknown>, key: string) {
  return Array.isArray(data[key]) ? data[key] : [];
}

function readUpdatedAt(data: Record<string, unknown>) {
  return readDate(data.updated_at) ?? new Date();
}

function readDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
