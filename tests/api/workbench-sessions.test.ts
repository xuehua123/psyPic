import { beforeEach, describe, expect, it } from "vitest";
import {
  DELETE,
  PATCH
} from "@/app/api/workbench/sessions/[sessionId]/route";
import {
  GET as listSessions,
  POST as createSession
} from "@/app/api/workbench/sessions/route";
import {
  listAuditLogs,
  resetAuditLogStore
} from "@/server/services/audit-log-service";
import { resetDevStore } from "@/server/services/dev-store";
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
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "timed_out" | "partial_image";
  createdAt: Date;
  project?: ProjectRow | null;
  session?: SessionRow | null;
};

describe("Workbench sessions API", () => {
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
    const response = await listSessions(
      apiRequest("/api/workbench/sessions?project_id=proj_missing")
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 503 in indexeddb fallback mode", async () => {
    process.env.PSYPIC_WORKBENCH_PROJECTS_STORE = "indexeddb";
    const cookie = await seedAuth("user_sessions");

    const response = await listSessions(
      apiRequest("/api/workbench/sessions?project_id=proj_missing", { cookie })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(body.error.code).toBe("workbench_store_unavailable");
  });

  it("creates, lists, patches and deletes sessions for the current project", async () => {
    const cookie = await seedAuth("user_sessions");
    const project = await createWorkbenchProjectForUser("user_sessions", {
      title: "Project"
    });

    const createResponse = await createSession(
      apiRequest("/api/workbench/sessions", {
        method: "POST",
        cookie,
        body: {
          project_id: project.id,
          title: "Session",
          custom_label: "Branch",
          is_pinned: true,
          last_read_at: "2026-05-09T06:00:00.000Z"
        }
      })
    );
    const createBody = await createResponse.json();
    const sessionId = createBody.data.id as string;
    const listResponse = await listSessions(
      apiRequest(`/api/workbench/sessions?project_id=${project.id}&limit=10`, {
        cookie
      })
    );
    const patchResponse = await PATCH(
      apiRequest(`/api/workbench/sessions/${sessionId}`, {
        method: "PATCH",
        cookie,
        body: {
          title: "Session v2",
          is_archived: true,
          custom_label: "Updated"
        }
      }),
      { params: Promise.resolve({ sessionId }) }
    );
    const patchBody = await patchResponse.json();
    const deleteResponse = await DELETE(
      apiRequest(`/api/workbench/sessions/${sessionId}`, {
        method: "DELETE",
        cookie
      }),
      { params: Promise.resolve({ sessionId }) }
    );

    expect(createResponse.status).toBe(200);
    expect(createBody.data).toMatchObject({
      project_id: project.id,
      title: "Session",
      custom_label: "Branch",
      is_pinned: true,
      last_read_at: "2026-05-09T06:00:00.000Z"
    });
    expect(listResponse.status).toBe(200);
    expect((await listResponse.json()).data.items).toHaveLength(1);
    expect(patchResponse.status).toBe(200);
    expect(patchBody.data).toMatchObject({
      title: "Session v2",
      is_archived: true,
      custom_label: "Updated"
    });
    expect(deleteResponse.status).toBe(200);
    const deleteBody = await deleteResponse.clone().json();
    const auditLogs = await listAuditLogs({ limit: 10 });
    expect(auditLogs.items[0]).toMatchObject({
      actor_user_id: "user_sessions",
      action: "workbench.session.deleted",
      target_type: "creative_session",
      target_id: sessionId,
      request_id: deleteBody.request_id
    });
  });

  it("maps cross-user session access to 403 and missing sessions to 404", async () => {
    const ownerCookie = await seedAuth("user_owner");
    const otherCookie = await seedAuth("user_other");
    const project = await createWorkbenchProjectForUser("user_owner", {
      title: "Owner project"
    });
    const createResponse = await createSession(
      apiRequest("/api/workbench/sessions", {
        method: "POST",
        cookie: ownerCookie,
        body: { project_id: project.id, title: "Owner session" }
      })
    );
    const sessionId = ((await createResponse.json()).data as { id: string }).id;

    const forbidden = await PATCH(
      apiRequest(`/api/workbench/sessions/${sessionId}`, {
        method: "PATCH",
        cookie: otherCookie,
        body: { title: "Steal" }
      }),
      { params: Promise.resolve({ sessionId }) }
    );
    const missing = await PATCH(
      apiRequest("/api/workbench/sessions/session_missing", {
        method: "PATCH",
        cookie: ownerCookie,
        body: { title: "Nope" }
      }),
      { params: Promise.resolve({ sessionId: "session_missing" }) }
    );

    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error.code).toBe("forbidden");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("not_found");
  });

  it("maps validation errors to 422", async () => {
    const cookie = await seedAuth("user_sessions");

    const response = await createSession(
      apiRequest("/api/workbench/sessions", {
        method: "POST",
        cookie,
        body: { project_id: "proj_missing", title: "" }
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
      findMany: async (input: { where: { projectId: string }; cursor?: { id: string }; skip?: number; take: number }) =>
        paginate(
          Array.from(sessions.values())
            .filter((session) => session.projectId === input.where.projectId)
            .sort(compareSessionRows)
            .map((session) => attachSessionProject(session, projects)),
          input
        ),
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
      findMany: async () => [],
      update: async () => {
        throw new Error("unused");
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

function compareSessionRows(left: SessionRow, right: SessionRow) {
  return (
    Number(right.isPinned) - Number(left.isPinned) ||
    right.updatedAt.getTime() - left.updatedAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}

function createSessionRow(data: Record<string, unknown>, now: Date): SessionRow {
  return {
    id: String(data.id),
    projectId: String(data.projectId),
    title: String(data.title),
    forkParentVersionNodeId:
      typeof data.forkParentVersionNodeId === "string"
        ? data.forkParentVersionNodeId
        : null,
    activeVersionNodeId:
      typeof data.activeVersionNodeId === "string"
        ? data.activeVersionNodeId
        : null,
    customLabel: typeof data.customLabel === "string" ? data.customLabel : null,
    isPinned: data.isPinned === true,
    isArchived: data.isArchived === true,
    lastReadAt: data.lastReadAt instanceof Date ? data.lastReadAt : null,
    createdAt: now,
    updatedAt: now
  };
}

function createVersionNodeRow(data: Record<string, unknown>, now: Date): VersionNodeRow {
  return {
    id: String(data.id),
    projectId: String(data.projectId),
    sessionId: String(data.sessionId),
    parentVersionNodeId: null,
    promptSnapshot: String(data.promptSnapshot),
    paramsSnapshot: data.paramsSnapshot,
    sourceAssetIds: data.sourceAssetIds,
    outputAssetIds: data.outputAssetIds,
    boardDocumentId: null,
    boardSnapshot: null,
    boardExportAssetId: null,
    branchLabel: null,
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
