import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/workbench/sync/route";
import { resetDevStore } from "@/server/services/dev-store";

type AuthUserRow = {
  id: string;
  email: string | null;
  emailNormalized: string | null;
  displayName: string | null;
  role: "user" | "admin";
  passwordHash: string | null;
  passwordSalt: string | null;
  status: "active" | "disabled";
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
  deletedAt: Date | null;
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
  deletedAt: Date | null;
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
  updatedAt: Date;
  deletedAt: Date | null;
  project?: ProjectRow | null;
  session?: SessionRow | null;
};

type MutationRow = {
  id: string;
  userId: string;
  clientMutationId: string;
  operation: string;
  targetType: string;
  targetId: string;
  result: unknown;
  createdAt: Date;
};

describe("Workbench sync API", () => {
  beforeEach(() => {
    resetDevStore();
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

  it("requires authentication and honors indexeddb fallback mode", async () => {
    const anonymous = await GET(apiRequest("/api/workbench/sync"));
    const anonymousBody = await anonymous.json();
    process.env.PSYPIC_WORKBENCH_PROJECTS_STORE = "indexeddb";
    const cookie = await seedAuth("user_sync");
    const fallback = await GET(apiRequest("/api/workbench/sync", { cookie }));
    const fallbackBody = await fallback.json();

    expect(anonymous.status).toBe(401);
    expect(anonymousBody.error.code).toBe("unauthorized");
    expect(fallback.status).toBe(503);
    expect(fallback.headers.get("retry-after")).toBe("30");
    expect(fallbackBody.error.code).toBe("workbench_store_unavailable");
  });

  it("replays client mutation ids idempotently without duplicating writes", async () => {
    const cookie = await seedAuth("user_sync");
    const body = {
      operations: [
        {
          client_mutation_id: "mut_project_create",
          entity: "project",
          action: "upsert",
          data: {
            id: "proj_sync_1",
            title: "Synced project",
            sort_order: 7,
            collapsed: false,
            updated_at: "2026-05-09T01:00:00.000Z"
          }
        }
      ],
      pull: { updated_since: "2026-05-09T00:00:00.000Z" }
    };

    const first = await POST(
      apiRequest("/api/workbench/sync", {
        method: "POST",
        cookie,
        body
      })
    );
    const second = await POST(
      apiRequest("/api/workbench/sync", {
        method: "POST",
        cookie,
        body
      })
    );
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(firstBody.data.push_results).toMatchObject([
      {
        client_mutation_id: "mut_project_create",
        status: "applied",
        entity: "project",
        id: "proj_sync_1"
      }
    ]);
    expect(second.status).toBe(200);
    expect(secondBody.data.push_results).toMatchObject([
      {
        client_mutation_id: "mut_project_create",
        status: "replayed",
        entity: "project",
        id: "proj_sync_1"
      }
    ]);
    expect(secondBody.data.pulled.projects).toHaveLength(1);
  });

  it("returns partial failures without rolling back successful operations", async () => {
    const ownerCookie = await seedAuth("user_owner");
    const otherCookie = await seedAuth("user_other");
    await POST(
      apiRequest("/api/workbench/sync", {
        method: "POST",
        cookie: ownerCookie,
        body: {
          operations: [
            {
              client_mutation_id: "mut_foreign_project",
              entity: "project",
              action: "upsert",
              data: {
                id: "proj_foreign",
                title: "Foreign",
                updated_at: "2026-05-09T01:00:00.000Z"
              }
            }
          ]
        }
      })
    );

    const response = await POST(
      apiRequest("/api/workbench/sync", {
        method: "POST",
        cookie: otherCookie,
        body: {
          operations: [
            {
              client_mutation_id: "mut_ok_project",
              entity: "project",
              action: "upsert",
              data: {
                id: "proj_owned",
                title: "Owned",
                updated_at: "2026-05-09T01:01:00.000Z"
              }
            },
            {
              client_mutation_id: "mut_bad_session",
              entity: "session",
              action: "upsert",
              data: {
                id: "session_bad",
                project_id: "proj_foreign",
                title: "Should fail",
                updated_at: "2026-05-09T01:02:00.000Z"
              }
            }
          ],
          pull: { updated_since: "2026-05-09T00:00:00.000Z" }
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.push_results).toMatchObject([
      { client_mutation_id: "mut_ok_project", status: "applied" },
      {
        client_mutation_id: "mut_bad_session",
        status: "error",
        code: "forbidden"
      }
    ]);
    expect(body.data.pulled.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "proj_owned", title: "Owned" })
      ])
    );
  });

  it("returns conflict payloads for stale updates and keeps the server record", async () => {
    const cookie = await seedAuth("user_sync");
    await POST(
      apiRequest("/api/workbench/sync", {
        method: "POST",
        cookie,
        body: {
          operations: [
            {
              client_mutation_id: "mut_fresh_project",
              entity: "project",
              action: "upsert",
              data: {
                id: "proj_conflict",
                title: "Fresh server",
                updated_at: "2026-05-09T02:00:00.000Z"
              }
            }
          ]
        }
      })
    );

    const response = await POST(
      apiRequest("/api/workbench/sync", {
        method: "POST",
        cookie,
        body: {
          operations: [
            {
              client_mutation_id: "mut_stale_project",
              entity: "project",
              action: "upsert",
              data: {
                id: "proj_conflict",
                title: "Stale client",
                updated_at: "2026-05-09T01:00:00.000Z"
              }
            }
          ]
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.push_results[0]).toMatchObject({
      client_mutation_id: "mut_stale_project",
      status: "conflict",
      entity: "project",
      id: "proj_conflict",
      server_record: {
        title: "Fresh server"
      }
    });
  });

  it("propagates deleted tombstones through incremental pull", async () => {
    const cookie = await seedAuth("user_sync");
    await POST(
      apiRequest("/api/workbench/sync", {
        method: "POST",
        cookie,
        body: {
          operations: [
            {
              client_mutation_id: "mut_project_for_delete",
              entity: "project",
              action: "upsert",
              data: {
                id: "proj_delete",
                title: "Delete me",
                updated_at: "2026-05-09T03:00:00.000Z"
              }
            },
            {
              client_mutation_id: "mut_session_for_delete",
              entity: "session",
              action: "upsert",
              data: {
                id: "session_delete",
                project_id: "proj_delete",
                title: "Cascade me",
                updated_at: "2026-05-09T03:01:00.000Z"
              }
            }
          ]
        }
      })
    );

    const response = await POST(
      apiRequest("/api/workbench/sync", {
        method: "POST",
        cookie,
        body: {
          operations: [
            {
              client_mutation_id: "mut_project_delete",
              entity: "project",
              action: "delete",
              data: {
                id: "proj_delete",
                updated_at: "2026-05-09T03:02:00.000Z"
              }
            }
          ],
          pull: { updated_since: "2026-05-09T03:01:30.000Z" }
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.push_results).toMatchObject([
      { client_mutation_id: "mut_project_delete", status: "applied" }
    ]);
    expect(body.data.pulled.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "proj_delete",
          deleted_at: expect.any(String)
        })
      ])
    );
    expect(body.data.pulled.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "session_delete",
          deleted_at: expect.any(String)
        })
      ])
    );
  });

  it("rejects oversized sync batches", async () => {
    const cookie = await seedAuth("user_sync");
    const response = await POST(
      apiRequest("/api/workbench/sync", {
        method: "POST",
        cookie,
        body: {
          operations: Array.from({ length: 51 }, (_, index) => ({
            client_mutation_id: `mut_${index}`,
            entity: "project",
            action: "upsert",
            data: {
              id: `proj_${index}`,
              title: `Project ${index}`,
              updated_at: "2026-05-09T04:00:00.000Z"
            }
          }))
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error.code).toBe("payload_too_large");
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
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
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
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
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
  const mutations = new Map<string, MutationRow>();

  return {
    workbenchProject: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = createProjectRow(data);
        projects.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.get(where.id) ?? null,
      findMany: async (input: { where: Record<string, unknown> }) =>
        Array.from(projects.values()).filter((project) =>
          matchesWhere(project, input.where)
        ),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = projects.get(where.id);
        if (!current) throw new Error("missing project");
        const row = { ...current, ...data } as ProjectRow;
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
        const row = createSessionRow(data);
        sessions.set(row.id, row);
        return attachSessionProject(row, projects);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = sessions.get(where.id);
        return row ? attachSessionProject(row, projects) : null;
      },
      findMany: async (input: { where: Record<string, unknown> }) =>
        Array.from(sessions.values())
          .map((session) => attachSessionProject(session, projects))
          .filter((session) => matchesWhere(session, input.where)),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = sessions.get(where.id);
        if (!current) throw new Error("missing session");
        const row = { ...current, ...data } as SessionRow;
        sessions.set(row.id, row);
        return attachSessionProject(row, projects);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = sessions.get(where.id);
        if (!row) throw new Error("missing session");
        sessions.delete(where.id);
        return attachSessionProject(row, projects);
      }
    },
    versionNode: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = createVersionNodeRow(data);
        versionNodes.set(row.id, row);
        return attachNodeRelations(row, projects, sessions);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = versionNodes.get(where.id);
        return row ? attachNodeRelations(row, projects, sessions) : null;
      },
      findMany: async (input: { where: Record<string, unknown> }) =>
        Array.from(versionNodes.values())
          .map((node) => attachNodeRelations(node, projects, sessions))
          .filter((node) => matchesWhere(node, input.where)),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = versionNodes.get(where.id);
        if (!current) throw new Error("missing node");
        const row = { ...current, ...data } as VersionNodeRow;
        versionNodes.set(row.id, row);
        return attachNodeRelations(row, projects, sessions);
      }
    },
    workbenchSyncMutation: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: MutationRow = {
          id: String(data.id),
          userId: String(data.userId),
          clientMutationId: String(data.clientMutationId),
          operation: String(data.operation),
          targetType: String(data.targetType),
          targetId: String(data.targetId),
          result: data.result,
          createdAt:
            data.createdAt instanceof Date ? data.createdAt : new Date()
        };
        mutations.set(`${row.userId}:${row.clientMutationId}`, row);
        return row;
      },
      findUnique: async ({
        where
      }: {
        where: { userId_clientMutationId: { userId: string; clientMutationId: string } };
      }) =>
        mutations.get(
          `${where.userId_clientMutationId.userId}:${where.userId_clientMutationId.clientMutationId}`
        ) ?? null
    }
  };
}

function findByWhere<T extends Record<string, unknown>>(
  rows: Map<string, T>,
  where: Record<string, unknown>
) {
  return (
    Array.from(rows.values()).find((row) =>
      Object.entries(where).every(([key, value]) => row[key] === value)
    ) ?? null
  );
}

function matchesWhere(
  row: Record<string, unknown>,
  where: Record<string, unknown>
): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "gt" in value) {
      const rowValue = row[key];
      return rowValue instanceof Date && rowValue > (value as { gt: Date }).gt;
    }

    if (key === "project" && value && typeof value === "object") {
      const project = row.project as Record<string, unknown> | undefined;
      const projectFilter = value as Record<string, unknown>;
      if (projectFilter.is && typeof projectFilter.is === "object") {
        return project
          ? matchesWhere(project, projectFilter.is as Record<string, unknown>)
          : false;
      }

      return project
        ? matchesWhere(project, value as Record<string, unknown>)
        : false;
    }

    return row[key] === value;
  });
}

function createProjectRow(data: Record<string, unknown>): ProjectRow {
  const updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date();
  return {
    id: String(data.id),
    userId: String(data.userId),
    title: String(data.title),
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
    collapsed: data.collapsed === true,
    activeSessionId:
      typeof data.activeSessionId === "string" ? data.activeSessionId : null,
    createdAt: data.createdAt instanceof Date ? data.createdAt : updatedAt,
    updatedAt,
    deletedAt: data.deletedAt instanceof Date ? data.deletedAt : null
  };
}

function createSessionRow(data: Record<string, unknown>): SessionRow {
  const updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date();
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
    createdAt: data.createdAt instanceof Date ? data.createdAt : updatedAt,
    updatedAt,
    deletedAt: data.deletedAt instanceof Date ? data.deletedAt : null
  };
}

function createVersionNodeRow(data: Record<string, unknown>): VersionNodeRow {
  const updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date();
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
    createdAt: data.createdAt instanceof Date ? data.createdAt : updatedAt,
    updatedAt,
    deletedAt: data.deletedAt instanceof Date ? data.deletedAt : null
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
