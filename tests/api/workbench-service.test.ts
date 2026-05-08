import { beforeEach, describe, expect, it } from "vitest";
import {
  createCreativeSessionForUser,
  getCreativeSessionForUser,
  listCreativeSessionsForUser,
  updateCreativeSessionForUser
} from "@/server/services/creative-session-service";
import {
  createVersionNodeForUser,
  getVersionNodeForUser,
  listVersionNodesForUser
} from "@/server/services/version-node-service";
import {
  createWorkbenchProjectForUser,
  deleteWorkbenchProjectForUser,
  getWorkbenchProjectForUser,
  listWorkbenchProjectsForUser,
  updateWorkbenchProjectForUser,
  WorkbenchServiceError
} from "@/server/services/workbench-project-service";

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

type ImageTaskRow = {
  id: string;
  projectId: string | null;
  sessionId: string | null;
  versionNodeId: string | null;
};

describe("workbench domain services", () => {
  beforeEach(() => {
    (
      globalThis as unknown as {
        __psypicWorkbenchPrismaClient?: ReturnType<typeof createWorkbenchPrismaDouble>;
      }
    ).__psypicWorkbenchPrismaClient = createWorkbenchPrismaDouble();
  });

  it("keeps projects scoped to the requesting user and lists them in stable pages", async () => {
    const first = await createWorkbenchProjectForUser("user_a", {
      title: "A first",
      sortOrder: 20
    });
    await createWorkbenchProjectForUser("user_b", {
      title: "B private",
      sortOrder: 10
    });
    const second = await createWorkbenchProjectForUser("user_a", {
      title: "A second",
      sortOrder: 10
    });

    await expect(getWorkbenchProjectForUser("user_b", first.id)).rejects.toMatchObject(
      { code: "forbidden" }
    );

    const page = await listWorkbenchProjectsForUser("user_a", { limit: 1 });
    const nextPage = await listWorkbenchProjectsForUser("user_a", {
      cursor: page.nextCursor,
      limit: 1
    });

    expect(page.items.map((project) => project.id)).toEqual([second.id]);
    expect(nextPage.items.map((project) => project.id)).toEqual([first.id]);

    const updated = await updateWorkbenchProjectForUser("user_a", first.id, {
      title: "Renamed",
      collapsed: true,
      sortOrder: 5
    });

    expect(updated).toMatchObject({
      id: first.id,
      title: "Renamed",
      collapsed: true,
      sort_order: 5
    });
  });

  it("rejects project active session pointers outside the same owned project", async () => {
    const project = await createWorkbenchProjectForUser("user_a", {
      title: "Project"
    });
    const otherProject = await createWorkbenchProjectForUser("user_a", {
      title: "Other project"
    });
    const foreignProject = await createWorkbenchProjectForUser("user_b", {
      title: "Foreign project"
    });
    const session = await createCreativeSessionForUser("user_a", {
      projectId: project.id,
      title: "Owned session"
    });
    const otherProjectSession = await createCreativeSessionForUser("user_a", {
      projectId: otherProject.id,
      title: "Wrong project"
    });
    const foreignSession = await createCreativeSessionForUser("user_b", {
      projectId: foreignProject.id,
      title: "Foreign"
    });

    await expect(
      createWorkbenchProjectForUser("user_a", {
        title: "Cannot start active",
        activeSessionId: session.id
      })
    ).rejects.toMatchObject({ code: "invalid_relation" });
    await expect(
      updateWorkbenchProjectForUser("user_a", project.id, {
        activeSessionId: otherProjectSession.id
      })
    ).rejects.toMatchObject({ code: "invalid_relation" });
    await expect(
      updateWorkbenchProjectForUser("user_a", project.id, {
        activeSessionId: foreignSession.id
      })
    ).rejects.toMatchObject({ code: "forbidden" });

    await expect(
      updateWorkbenchProjectForUser("user_a", project.id, {
        activeSessionId: session.id
      })
    ).resolves.toMatchObject({ active_session_id: session.id });
  });

  it("keeps sessions scoped through project ownership and overwrites branch meta", async () => {
    const project = await createWorkbenchProjectForUser("user_a", {
      title: "Project"
    });
    const otherProject = await createWorkbenchProjectForUser("user_b", {
      title: "Other"
    });
    const session = await createCreativeSessionForUser("user_a", {
      projectId: project.id,
      title: "Draft",
      customLabel: "Before",
      isPinned: false,
      isArchived: false,
      lastReadAt: null
    });
    await createCreativeSessionForUser("user_b", {
      projectId: otherProject.id,
      title: "Private"
    });

    const readAt = new Date("2026-05-09T05:00:00.000Z");
    const updated = await updateCreativeSessionForUser("user_a", session.id, {
      title: "Draft v2",
      customLabel: "Pinned branch",
      isPinned: true,
      isArchived: true,
      lastReadAt: readAt
    });

    await expect(getCreativeSessionForUser("user_b", session.id)).rejects.toMatchObject(
      { code: "forbidden" }
    );
    expect(updated).toMatchObject({
      id: session.id,
      title: "Draft v2",
      custom_label: "Pinned branch",
      is_pinned: true,
      is_archived: true,
      last_read_at: readAt.toISOString()
    });

    const sessions = await listCreativeSessionsForUser("user_a", {
      projectId: project.id,
      limit: 10
    });

    expect(sessions.items).toHaveLength(1);
    expect(sessions.items[0]?.id).toBe(session.id);
  });

  it("rejects session version pointers outside the allowed ownership boundary", async () => {
    const project = await createWorkbenchProjectForUser("user_a", {
      title: "Project"
    });
    const otherProject = await createWorkbenchProjectForUser("user_a", {
      title: "Other project"
    });
    const foreignProject = await createWorkbenchProjectForUser("user_b", {
      title: "Foreign project"
    });
    const session = await createCreativeSessionForUser("user_a", {
      projectId: project.id,
      title: "Session"
    });
    const otherSession = await createCreativeSessionForUser("user_a", {
      projectId: otherProject.id,
      title: "Other session"
    });
    const foreignSession = await createCreativeSessionForUser("user_b", {
      projectId: foreignProject.id,
      title: "Foreign session"
    });
    const node = await createVersionNodeForUser("user_a", {
      projectId: project.id,
      sessionId: session.id,
      promptSnapshot: "owned",
      paramsSnapshot: {},
      sourceAssetIds: [],
      outputAssetIds: [],
      status: "succeeded"
    });
    const otherProjectNode = await createVersionNodeForUser("user_a", {
      projectId: otherProject.id,
      sessionId: otherSession.id,
      promptSnapshot: "wrong project",
      paramsSnapshot: {},
      sourceAssetIds: [],
      outputAssetIds: [],
      status: "succeeded"
    });
    const foreignNode = await createVersionNodeForUser("user_b", {
      projectId: foreignProject.id,
      sessionId: foreignSession.id,
      promptSnapshot: "foreign",
      paramsSnapshot: {},
      sourceAssetIds: [],
      outputAssetIds: [],
      status: "succeeded"
    });

    await expect(
      createCreativeSessionForUser("user_a", {
        projectId: project.id,
        title: "Bad active",
        activeVersionNodeId: node.id
      })
    ).rejects.toMatchObject({ code: "invalid_relation" });
    await expect(
      updateCreativeSessionForUser("user_a", session.id, {
        forkParentVersionNodeId: otherProjectNode.id
      })
    ).rejects.toMatchObject({ code: "invalid_relation" });
    await expect(
      updateCreativeSessionForUser("user_a", session.id, {
        forkParentVersionNodeId: foreignNode.id
      })
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      updateCreativeSessionForUser("user_a", session.id, {
        activeVersionNodeId: otherProjectNode.id
      })
    ).rejects.toMatchObject({ code: "invalid_relation" });

    await expect(
      updateCreativeSessionForUser("user_a", session.id, {
        forkParentVersionNodeId: node.id,
        activeVersionNodeId: node.id
      })
    ).resolves.toMatchObject({
      fork_parent_version_node_id: node.id,
      active_version_node_id: node.id
    });
  });

  it("keeps version nodes scoped to the owning user and paginates by stable creation order", async () => {
    const project = await createWorkbenchProjectForUser("user_a", {
      title: "Project"
    });
    const session = await createCreativeSessionForUser("user_a", {
      projectId: project.id,
      title: "Session"
    });
    const first = await createVersionNodeForUser("user_a", {
      projectId: project.id,
      sessionId: session.id,
      promptSnapshot: "first",
      paramsSnapshot: { n: 1 },
      sourceAssetIds: [],
      outputAssetIds: [],
      status: "queued"
    });
    const second = await createVersionNodeForUser("user_a", {
      projectId: project.id,
      sessionId: session.id,
      parentVersionNodeId: first.id,
      promptSnapshot: "second",
      paramsSnapshot: { n: 1 },
      sourceAssetIds: ["asset_source"],
      outputAssetIds: ["asset_output"],
      branchLabel: "variation",
      status: "succeeded"
    });

    await expect(getVersionNodeForUser("user_b", first.id)).rejects.toMatchObject({
      code: "forbidden"
    });

    const page = await listVersionNodesForUser("user_a", {
      sessionId: session.id,
      limit: 1
    });
    const nextPage = await listVersionNodesForUser("user_a", {
      sessionId: session.id,
      cursor: page.nextCursor,
      limit: 1
    });

    expect(page.items.map((node) => node.id)).toEqual([first.id]);
    expect(nextPage.items.map((node) => node.id)).toEqual([second.id]);
    expect(nextPage.items[0]).toMatchObject({
      parent_version_node_id: first.id,
      output_asset_ids: ["asset_output"],
      branch_label: "variation"
    });
  });

  it("deleting a project cascades sessions and version nodes but keeps image tasks", async () => {
    const prismaClient = (
      globalThis as unknown as {
        __psypicWorkbenchPrismaClient: ReturnType<typeof createWorkbenchPrismaDouble>;
      }
    ).__psypicWorkbenchPrismaClient;
    const project = await createWorkbenchProjectForUser("user_a", {
      title: "Project"
    });
    const session = await createCreativeSessionForUser("user_a", {
      projectId: project.id,
      title: "Session"
    });
    const node = await createVersionNodeForUser("user_a", {
      projectId: project.id,
      sessionId: session.id,
      promptSnapshot: "prompt",
      paramsSnapshot: {},
      sourceAssetIds: [],
      outputAssetIds: [],
      status: "running"
    });
    prismaClient.imageTask.seed({
      id: "task_keep",
      projectId: project.id,
      sessionId: session.id,
      versionNodeId: node.id
    });

    await deleteWorkbenchProjectForUser("user_a", project.id);

    await expect(getWorkbenchProjectForUser("user_a", project.id)).rejects.toBeInstanceOf(
      WorkbenchServiceError
    );
    await expect(getCreativeSessionForUser("user_a", session.id)).rejects.toMatchObject(
      { code: "not_found" }
    );
    await expect(getVersionNodeForUser("user_a", node.id)).rejects.toMatchObject({
      code: "not_found"
    });
    expect(prismaClient.imageTask.findSeed("task_keep")).toMatchObject({
      id: "task_keep",
      projectId: null,
      sessionId: null,
      versionNodeId: null
    });
  });
});

function createWorkbenchPrismaDouble() {
  const projects = new Map<string, ProjectRow>();
  const sessions = new Map<string, SessionRow>();
  const versionNodes = new Map<string, VersionNodeRow>();
  const imageTasks = new Map<string, ImageTaskRow>();
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
          collapsed: typeof data.collapsed === "boolean" ? data.collapsed : false,
          activeSessionId:
            typeof data.activeSessionId === "string" ? data.activeSessionId : null,
          createdAt: data.createdAt instanceof Date ? data.createdAt : now,
          updatedAt: data.updatedAt instanceof Date ? data.updatedAt : now
        };
        projects.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.get(where.id) ?? null,
      findMany: async (input: {
        where: { userId: string };
        orderBy: Array<Record<string, "asc" | "desc">>;
        cursor?: { id: string };
        skip?: number;
        take: number;
      }) =>
        paginate(
          Array.from(projects.values())
            .filter((project) => project.userId === input.where.userId)
            .sort(compareBy([
              ["sortOrder", "asc"],
              ["updatedAt", "desc"],
              ["id", "asc"]
            ])),
          input
        ),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = projects.get(where.id);
        if (!current) {
          throw new Error("missing project");
        }
        const row = {
          ...current,
          ...data,
          updatedAt: nextDate()
        } as ProjectRow;
        projects.set(row.id, row);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const current = projects.get(where.id);
        if (!current) {
          throw new Error("missing project");
        }
        projects.delete(where.id);
        for (const session of Array.from(sessions.values())) {
          if (session.projectId === where.id) {
            sessions.delete(session.id);
          }
        }
        for (const node of Array.from(versionNodes.values())) {
          if (node.projectId === where.id) {
            versionNodes.delete(node.id);
          }
        }
        for (const task of imageTasks.values()) {
          if (task.projectId === where.id) {
            task.projectId = null;
          }
          if (task.sessionId && !sessions.has(task.sessionId)) {
            task.sessionId = null;
          }
          if (task.versionNodeId && !versionNodes.has(task.versionNodeId)) {
            task.versionNodeId = null;
          }
        }
        return current;
      }
    },
    creativeSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = nextDate();
        const row: SessionRow = {
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
          customLabel:
            typeof data.customLabel === "string" ? data.customLabel : null,
          isPinned: data.isPinned === true,
          isArchived: data.isArchived === true,
          lastReadAt: data.lastReadAt instanceof Date ? data.lastReadAt : null,
          createdAt: data.createdAt instanceof Date ? data.createdAt : now,
          updatedAt: data.updatedAt instanceof Date ? data.updatedAt : now
        };
        sessions.set(row.id, row);
        return attachSessionProject(row);
      },
      findUnique: async ({
        where
      }: {
        where: { id: string };
        include?: Record<string, unknown>;
      }) => {
        const row = sessions.get(where.id);
        return row ? attachSessionProject(row) : null;
      },
      findMany: async (input: {
        where: { projectId: string };
        orderBy: Array<Record<string, "asc" | "desc">>;
        cursor?: { id: string };
        skip?: number;
        take: number;
      }) =>
        paginate(
          Array.from(sessions.values())
            .filter((session) => session.projectId === input.where.projectId)
            .sort(compareBy([
              ["isPinned", "desc"],
              ["updatedAt", "desc"],
              ["id", "asc"]
            ]))
            .map(attachSessionProject),
          input
        ),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = sessions.get(where.id);
        if (!current) {
          throw new Error("missing session");
        }
        const row = {
          ...current,
          ...data,
          updatedAt: nextDate()
        } as SessionRow;
        sessions.set(row.id, row);
        return attachSessionProject(row);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const current = sessions.get(where.id);
        if (!current) {
          throw new Error("missing session");
        }
        sessions.delete(where.id);
        for (const node of Array.from(versionNodes.values())) {
          if (node.sessionId === where.id) {
            versionNodes.delete(node.id);
          }
        }
        for (const task of imageTasks.values()) {
          if (task.sessionId === where.id) {
            task.sessionId = null;
          }
          if (task.versionNodeId && !versionNodes.has(task.versionNodeId)) {
            task.versionNodeId = null;
          }
        }
        return attachSessionProject(current);
      }
    },
    versionNode: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: VersionNodeRow = {
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
            typeof data.boardExportAssetId === "string"
              ? data.boardExportAssetId
              : null,
          branchLabel:
            typeof data.branchLabel === "string" ? data.branchLabel : null,
          status: data.status as VersionNodeRow["status"],
          createdAt: data.createdAt instanceof Date ? data.createdAt : nextDate()
        };
        versionNodes.set(row.id, row);
        return attachNodeRelations(row);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = versionNodes.get(where.id);
        return row ? attachNodeRelations(row) : null;
      },
      findMany: async (input: {
        where: { sessionId: string };
        orderBy: Array<Record<string, "asc" | "desc">>;
        cursor?: { id: string };
        skip?: number;
        take: number;
      }) =>
        paginate(
          Array.from(versionNodes.values())
            .filter((node) => node.sessionId === input.where.sessionId)
            .sort(compareBy([
              ["createdAt", "asc"],
              ["id", "asc"]
            ]))
            .map(attachNodeRelations),
          input
        ),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = versionNodes.get(where.id);
        if (!current) {
          throw new Error("missing node");
        }
        const row = { ...current, ...data } as VersionNodeRow;
        versionNodes.set(row.id, row);
        return attachNodeRelations(row);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const current = versionNodes.get(where.id);
        if (!current) {
          throw new Error("missing node");
        }
        versionNodes.delete(where.id);
        for (const task of imageTasks.values()) {
          if (task.versionNodeId === where.id) {
            task.versionNodeId = null;
          }
        }
        return attachNodeRelations(current);
      }
    },
    imageTask: {
      seed: (row: ImageTaskRow) => {
        imageTasks.set(row.id, row);
      },
      findSeed: (id: string) => imageTasks.get(id)
    }
  };

  function attachSessionProject(row: SessionRow) {
    return { ...row, project: projects.get(row.projectId) ?? null };
  }

  function attachNodeRelations(row: VersionNodeRow) {
    return {
      ...row,
      project: projects.get(row.projectId) ?? null,
      session: sessions.get(row.sessionId) ?? null
    };
  }
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

function compareBy<T extends Record<string, unknown>>(
  fields: Array<[keyof T, "asc" | "desc"]>
) {
  return (left: T, right: T) => {
    for (const [field, direction] of fields) {
      const order = compareValue(left[field], right[field]);
      if (order !== 0) {
        return direction === "asc" ? order : -order;
      }
    }

    return 0;
  };
}

function compareValue(left: unknown, right: unknown) {
  const leftValue = normalizeComparable(left);
  const rightValue = normalizeComparable(right);

  if (leftValue === rightValue) {
    return 0;
  }

  return leftValue > rightValue ? 1 : -1;
}

function normalizeComparable(value: unknown) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return "";
}
