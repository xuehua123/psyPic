import { beforeEach, describe, expect, it } from "vitest";
import {
  GET,
  PATCH
} from "@/app/api/workbench/version-nodes/[nodeId]/route";
import {
  GET as listNodes,
  POST as createNode
} from "@/app/api/workbench/version-nodes/route";
import {
  listAuditLogs,
  resetAuditLogStore
} from "@/server/services/audit-log-service";
import { resetDevStore } from "@/server/services/dev-store";
import { createCreativeSessionForUser } from "@/server/services/creative-session-service";
import { createWorkbenchProjectForUser } from "@/server/services/workbench-project-service";

type AuthUserRow = {
  id: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  email: string | null;
  emailNormalized: string | null;
  displayName: string | null;
  passwordHash: string | null;
  passwordSalt: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

type AuthSessionRow = {
  id: string;
  userId: string;
  keyBindingId: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
};

type ProjectRow = {
  id: string;
  userId: string;
  title: string;
  sortOrder: number;
  collapsed: boolean;
  activeSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRow = {
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
  project?: ProjectRow | null;
};

type VersionNodeRow = {
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
  project?: ProjectRow | null;
  session?: SessionRow | null;
};

describe("Workbench version nodes API", () => {
  beforeEach(() => {
    resetDevStore();
    resetAuditLogStore();
    delete process.env.PSYPIC_WORKBENCH_PROJECTS_STORE;
    (
      globalThis as unknown as {
        __psypicAuthPrismaClient?: ReturnType<typeof createAuthPrismaDouble>;
      }
    ).__psypicAuthPrismaClient = createAuthPrismaDouble();
    (
      globalThis as unknown as {
        __psypicWorkbenchPrismaClient?: ReturnType<
          typeof createWorkbenchPrismaDouble
        >;
      }
    ).__psypicWorkbenchPrismaClient = createWorkbenchPrismaDouble();
  });

  it("requires authentication", async () => {
    const response = await listNodes(
      apiRequest("/api/workbench/version-nodes?session_id=session_missing")
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 503 in indexeddb fallback mode", async () => {
    process.env.PSYPIC_WORKBENCH_PROJECTS_STORE = "indexeddb";
    const cookie = await seedAuth("user_nodes");

    const response = await listNodes(
      apiRequest("/api/workbench/version-nodes?session_id=session_missing", {
        cookie
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(body.error.code).toBe("workbench_store_unavailable");
  });

  it("creates, lists, reads and patches version nodes for the current session", async () => {
    const cookie = await seedAuth("user_nodes");
    const project = await createWorkbenchProjectForUser("user_nodes", {
      title: "Project"
    });
    const session = await createCreativeSessionForUser("user_nodes", {
      projectId: project.id,
      title: "Session"
    });

    const createResponse = await createNode(
      apiRequest("/api/workbench/version-nodes", {
        method: "POST",
        cookie,
        body: {
          project_id: project.id,
          session_id: session.id,
          prompt_snapshot: "Generate a clean product photo",
          params_snapshot: { n: 1 },
          source_asset_ids: ["asset_source"],
          output_asset_ids: [],
          status: "queued"
        }
      })
    );
    const createBody = await createResponse.json();
    const nodeId = createBody.data.id as string;
    const listResponse = await listNodes(
      apiRequest(`/api/workbench/version-nodes?session_id=${session.id}`, {
        cookie
      })
    );
    const getResponse = await GET(
      apiRequest(`/api/workbench/version-nodes/${nodeId}`, { cookie }),
      { params: Promise.resolve({ nodeId }) }
    );
    const patchResponse = await PATCH(
      apiRequest(`/api/workbench/version-nodes/${nodeId}`, {
        method: "PATCH",
        cookie,
        body: {
          status: "succeeded",
          output_asset_ids: ["asset_output"],
          branch_label: "final"
        }
      }),
      { params: Promise.resolve({ nodeId }) }
    );
    const patchBody = await patchResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createBody.data).toMatchObject({
      project_id: project.id,
      session_id: session.id,
      prompt_snapshot: "Generate a clean product photo",
      source_asset_ids: ["asset_source"],
      status: "queued"
    });
    expect(listResponse.status).toBe(200);
    expect((await listResponse.json()).data.items).toHaveLength(1);
    expect(getResponse.status).toBe(200);
    expect(patchResponse.status).toBe(200);
    expect(patchBody.data).toMatchObject({
      status: "succeeded",
      output_asset_ids: ["asset_output"],
      branch_label: "final"
    });
    const auditLogs = await listAuditLogs({ limit: 10 });
    expect(auditLogs.items[0]).toMatchObject({
      actor_user_id: "user_nodes",
      action: "workbench.version_node.status_overridden",
      target_type: "version_node",
      target_id: nodeId,
      request_id: patchBody.request_id,
      metadata: {
        status: "succeeded"
      }
    });
  });

  it("maps cross-user node access to 403 and missing nodes to 404", async () => {
    const ownerCookie = await seedAuth("user_owner");
    const otherCookie = await seedAuth("user_other");
    const project = await createWorkbenchProjectForUser("user_owner", {
      title: "Owner project"
    });
    const session = await createCreativeSessionForUser("user_owner", {
      projectId: project.id,
      title: "Owner session"
    });
    const createResponse = await createNode(
      apiRequest("/api/workbench/version-nodes", {
        method: "POST",
        cookie: ownerCookie,
        body: {
          project_id: project.id,
          session_id: session.id,
          prompt_snapshot: "owner",
          params_snapshot: {},
          source_asset_ids: [],
          output_asset_ids: [],
          status: "queued"
        }
      })
    );
    const nodeId = ((await createResponse.json()).data as { id: string }).id;

    const forbidden = await GET(
      apiRequest(`/api/workbench/version-nodes/${nodeId}`, { cookie: otherCookie }),
      { params: Promise.resolve({ nodeId }) }
    );
    const missing = await GET(
      apiRequest("/api/workbench/version-nodes/ver_missing", {
        cookie: ownerCookie
      }),
      { params: Promise.resolve({ nodeId: "ver_missing" }) }
    );

    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error.code).toBe("forbidden");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("not_found");
  });

  it("maps validation errors to 422", async () => {
    const cookie = await seedAuth("user_nodes");

    const response = await createNode(
      apiRequest("/api/workbench/version-nodes", {
        method: "POST",
        cookie,
        body: {
          project_id: "proj_missing",
          session_id: "session_missing",
          prompt_snapshot: "",
          params_snapshot: {},
          source_asset_ids: [],
          output_asset_ids: [],
          status: "queued"
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("invalid_parameter");
  });
});

function apiRequest(
  path: string,
  input?: { method?: string; cookie?: string; body?: unknown }
) {
  return new Request(`http://localhost${path}`, {
    method: input?.method ?? "GET",
    headers: {
      ...(input?.body === undefined ? {} : { "content-type": "application/json" }),
      ...(input?.cookie ? { cookie: input.cookie } : {})
    },
    body: input?.body === undefined ? undefined : JSON.stringify(input.body)
  });
}

async function seedAuth(userId: string) {
  const client = (
    globalThis as unknown as {
      __psypicAuthPrismaClient?: ReturnType<typeof createAuthPrismaDouble>;
    }
  ).__psypicAuthPrismaClient;
  if (!client) {
    throw new Error("missing auth client");
  }
  await client.user.create({
    data: {
      id: userId,
      email: `${userId}@example.com`,
      emailNormalized: `${userId}@example.com`,
      displayName: userId,
      role: "user",
      status: "active"
    }
  });
  await client.session.create({
    data: {
      id: `sess_${userId}`,
      userId,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-05-09T00:00:00.000Z"),
      lastSeenAt: new Date("2026-05-09T00:00:00.000Z")
    }
  });

  return `psypic_session=sess_${userId}`;
}

function createAuthPrismaDouble() {
  const users = new Map<string, AuthUserRow>();
  const sessions = new Map<string, AuthSessionRow>();

  return {
    user: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date("2026-05-09T00:00:00.000Z");
        const row: AuthUserRow = {
          id: String(data.id),
          email: typeof data.email === "string" ? data.email : null,
          emailNormalized:
            typeof data.emailNormalized === "string" ? data.emailNormalized : null,
          displayName:
            typeof data.displayName === "string" ? data.displayName : null,
          role: data.role === "admin" ? "admin" : "user",
          passwordHash: null,
          passwordSalt: null,
          status: data.status === "disabled" ? "disabled" : "active",
          createdAt: now,
          updatedAt: now,
          lastLoginAt: null
        };
        users.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        findByWhere(users, where),
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        findByWhere(users, where),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...users.get(where.id), ...data } as AuthUserRow;
        users.set(row.id, row);
        return row;
      }
    },
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: AuthSessionRow = {
          id: String(data.id),
          userId: String(data.userId),
          keyBindingId: null,
          expiresAt:
            data.expiresAt instanceof Date ? data.expiresAt : new Date(),
          createdAt:
            data.createdAt instanceof Date ? data.createdAt : new Date(),
          lastSeenAt:
            data.lastSeenAt instanceof Date ? data.lastSeenAt : new Date(),
          revokedAt: null
        };
        sessions.set(row.id, row);
        return { ...row, user: users.get(row.userId) ?? null };
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = findByWhere(sessions, where);
        return row ? { ...row, user: users.get(row.userId) ?? null } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...sessions.get(where.id), ...data } as AuthSessionRow;
        sessions.set(row.id, row);
        return { ...row, user: users.get(row.userId) ?? null };
      }
    }
  };
}

function createWorkbenchPrismaDouble() {
  const projects = new Map<string, ProjectRow>();
  const sessions = new Map<string, SessionRow>();
  const versionNodes = new Map<string, VersionNodeRow>();
  let sequence = 0;
  const nextDate = () =>
    new Date(`2026-05-09T00:00:${String(sequence++).padStart(2, "0")}.000Z`);

  return {
    workbenchProject: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = nextDate();
        const row: ProjectRow = {
          id: String(data.id),
          userId: String(data.userId),
          title: String(data.title),
          sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
          collapsed: false,
          activeSessionId: null,
          createdAt: now,
          updatedAt: now
        };
        projects.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.get(where.id) ?? null,
      findMany: async () => [],
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...projects.get(where.id), ...data, updatedAt: nextDate() } as ProjectRow;
        projects.set(row.id, row);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = projects.get(where.id);
        if (!row) throw new Error("missing project");
        projects.delete(where.id);
        return row;
      }
    },
    creativeSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = nextDate();
        const row = createSessionRow(data, now);
        sessions.set(row.id, row);
        return attachSessionProject(row, projects);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = sessions.get(where.id);
        return row ? attachSessionProject(row, projects) : null;
      },
      findMany: async () => [],
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const current = sessions.get(where.id);
        if (!current) throw new Error("missing session");
        const row = { ...current, ...data, updatedAt: nextDate() } as SessionRow;
        sessions.set(row.id, row);
        return attachSessionProject(row, projects);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const current = sessions.get(where.id);
        if (!current) throw new Error("missing session");
        sessions.delete(where.id);
        return attachSessionProject(current, projects);
      }
    },
    versionNode: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = createVersionNodeRow(data, nextDate());
        versionNodes.set(row.id, row);
        return attachNodeRelations(row, projects, sessions);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = versionNodes.get(where.id);
        return row ? attachNodeRelations(row, projects, sessions) : null;
      },
      findMany: async (input: { where: { sessionId: string }; cursor?: { id: string }; skip?: number; take: number }) =>
        paginate(
          Array.from(versionNodes.values())
            .filter((node) => node.sessionId === input.where.sessionId)
            .sort(compareNodeRows)
            .map((node) => attachNodeRelations(node, projects, sessions)),
          input
        ),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const current = versionNodes.get(where.id);
        if (!current) throw new Error("missing node");
        const row = { ...current, ...data } as VersionNodeRow;
        versionNodes.set(row.id, row);
        return attachNodeRelations(row, projects, sessions);
      }
    }
  };
}

function findByWhere<T extends Record<string, unknown>>(
  rows: Map<string, T>,
  where: Record<string, unknown>
) {
  return Array.from(rows.values()).find((row) =>
    Object.entries(where).every(([key, value]) => row[key] === value)
  ) ?? null;
}

function paginate<T extends { id: string }>(
  rows: T[],
  input: { cursor?: { id: string }; skip?: number; take: number }
) {
  const cursorIndex = input.cursor
    ? rows.findIndex((row) => row.id === input.cursor?.id)
    : -1;
  const start = cursorIndex >= 0 ? cursorIndex + (input.skip ?? 0) : 0;
  return rows.slice(start, start + input.take);
}

function compareNodeRows(left: VersionNodeRow, right: VersionNodeRow) {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}

function createSessionRow(data: Record<string, unknown>, now: Date): SessionRow {
  return {
    id: String(data.id),
    projectId: String(data.projectId),
    title: String(data.title),
    forkParentVersionNodeId: null,
    activeVersionNodeId: null,
    customLabel: null,
    isPinned: false,
    isArchived: false,
    lastReadAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function createVersionNodeRow(data: Record<string, unknown>, now: Date): VersionNodeRow {
  return {
    id: String(data.id),
    projectId: String(data.projectId),
    sessionId: String(data.sessionId),
    parentVersionNodeId:
      typeof data.parentVersionNodeId === "string"
        ? data.parentVersionNodeId
        : null,
    promptSnapshot: String(data.promptSnapshot),
    paramsSnapshot: data.paramsSnapshot,
    sourceAssetIds: data.sourceAssetIds,
    outputAssetIds: data.outputAssetIds,
    boardDocumentId:
      typeof data.boardDocumentId === "string" ? data.boardDocumentId : null,
    boardSnapshot: data.boardSnapshot ?? null,
    boardExportAssetId:
      typeof data.boardExportAssetId === "string" ? data.boardExportAssetId : null,
    branchLabel: typeof data.branchLabel === "string" ? data.branchLabel : null,
    status: data.status as VersionNodeRow["status"],
    createdAt: now
  };
}

function attachSessionProject(row: SessionRow, projects: Map<string, ProjectRow>) {
  return { ...row, project: projects.get(row.projectId) ?? null };
}

function attachNodeRelations(
  row: VersionNodeRow,
  projects: Map<string, ProjectRow>,
  sessions: Map<string, SessionRow>
) {
  return {
    ...row,
    project: projects.get(row.projectId) ?? null,
    session: sessions.get(row.sessionId) ?? null
  };
}
