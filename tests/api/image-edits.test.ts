import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as editImage } from "@/app/api/images/edits/route";
import { POST as saveManualKey } from "@/app/api/settings/manual-key/route";
import {
  listAuditLogs,
  resetAuditLogStore
} from "@/server/services/audit-log-service";
import { getKeyBinding, getSession, resetDevStore } from "@/server/services/dev-store";
import {
  createImageTask,
  getImageTaskForUser,
  markImageTaskRunning,
  resetImageTaskStore
} from "@/server/services/image-task-service";
import { resetRuntimeSettingsStore } from "@/server/services/runtime-settings-service";
import { resetTempAssetStore } from "@/server/services/temp-asset-service";
import { createCreativeSessionForUser } from "@/server/services/creative-session-service";
import {
  createVersionNodeForUser,
  listVersionNodesForUser
} from "@/server/services/version-node-service";
import { createWorkbenchProjectForUser } from "@/server/services/workbench-project-service";
import {
  clearAuthPrismaDouble,
  installAuthPrismaDouble
} from "./support/auth-prisma-double";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const validTaskParams = {
  prompt: "Keep the product unchanged and replace the background.",
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "medium",
  n: 1,
  output_format: "png",
  output_compression: null,
  background: "auto",
  moderation: "auto"
} as const;

async function bindSession() {
  const response = await exchangeImportCode(
    new Request("http://localhost/api/import/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ import_code: "valid_one_time_code" })
    })
  );

  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function bindDatabaseSession() {
  installAuthPrismaDouble();
  const registerResponse = await register(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "edit-db@example.com",
        password: "correct horse battery staple",
        display_name: "Edit DB"
      })
    })
  );
  const registerBody = await registerResponse.json();
  const cookie = registerResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
  const manualKeyResponse = await saveManualKey(
    new Request("http://localhost/api/settings/manual-key", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        base_url: "https://sub2api.example.com/v1",
        api_key: "secret-token-value",
        default_model: "gpt-image-2"
      })
    })
  );

  expect(registerResponse.status).toBe(200);
  expect(manualKeyResponse.status).toBe(200);

  return {
    cookie,
    userId: registerBody.data.user.id as string
  };
}

function editRequest(cookie: string, formData: FormData) {
  const request = new Request("http://localhost/api/images/edits", {
    method: "POST",
    headers: {
      cookie
    }
  });
  Object.defineProperty(request, "formData", {
    value: () => Promise.resolve(formData)
  });

  return request;
}

function validEditFormData() {
  const formData = new FormData();
  formData.set("prompt", validTaskParams.prompt);
  formData.set("model", validTaskParams.model);
  formData.set("size", validTaskParams.size);
  formData.set("quality", validTaskParams.quality);
  formData.set("n", String(validTaskParams.n));
  formData.set("output_format", validTaskParams.output_format);
  formData.set("background", validTaskParams.background);
  formData.set("moderation", validTaskParams.moderation);
  formData.set("image", new File([pngBytes], "product.png", { type: "image/png" }));

  return formData;
}

function pngWithDimensions(width: number, height: number) {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52,
    (width >>> 24) & 0xff,
    (width >>> 16) & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    (height >>> 24) & 0xff,
    (height >>> 16) & 0xff,
    (height >>> 8) & 0xff,
    height & 0xff
  ]);
}

async function createRunningTaskForCookie(cookie: string) {
  const sessionId = cookie.replace("psypic_session=", "");
  const session = getSession(sessionId);

  if (!session) {
    throw new Error("Expected test session");
  }

  const binding = getKeyBinding(session.key_binding_id);

  if (!binding) {
    throw new Error("Expected test key binding");
  }

  const task = await createImageTask({
    userId: session.user_id,
    keyBindingId: binding.id,
    type: "generation",
    prompt: validTaskParams.prompt,
    params: validTaskParams
  });
  await markImageTaskRunning(task.id);
}

describe("POST /api/images/edits", () => {
  beforeEach(() => {
    clearAuthPrismaDouble();
  });

  it("edits a single reference image through Sub2API and returns TempAsset URLs", async () => {
    resetDevStore();
    resetAuditLogStore();
    resetRuntimeSettingsStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("edited-image").toString("base64") }],
            usage: { input_tokens: 15, output_tokens: 25, total_tokens: 40 }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-request-id": "upstream_edit_req_123"
            }
          }
        )
      )
    );

    const response = await editImage(editRequest(cookie, validEditFormData()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.task_id).toMatch(/^task_/);
    expect(body.data.images[0]).toMatchObject({
      asset_id: expect.stringMatching(/^asset_/),
      url: expect.stringMatching(/^\/api\/assets\/asset_/),
      format: "png"
    });
    expect(body.data.usage).toMatchObject({
      input_tokens: 15,
      output_tokens: 25,
      total_tokens: 40
    });
    expect(body.request_id).toMatch(/^psypic_req_/);
    expect(body.upstream_request_id).toBe("upstream_edit_req_123");
    expect(JSON.stringify(body)).not.toContain("api_key");
    expect(JSON.stringify(body)).not.toContain("secret-token");
    const auditLogs = await listAuditLogs({ limit: 10 });
    expect(auditLogs.items[0]).toMatchObject({
      action: "image_edit.succeeded",
      target_id: body.data.task_id,
      metadata: expect.objectContaining({
        upstream_request_id: "upstream_edit_req_123"
      })
    });
  });

  it("links context-aware edits as child workbench version nodes", async () => {
    resetDevStore();
    resetAuditLogStore();
    resetRuntimeSettingsStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    setWorkbenchPrismaDouble();
    const cookie = await bindSession();
    const sessionId = cookie.replace("psypic_session=", "");
    const session = getSession(sessionId);

    if (!session) {
      throw new Error("Expected test session");
    }

    const project = await createWorkbenchProjectForUser(session.user_id, {
      title: "Edit project"
    });
    const creativeSession = await createCreativeSessionForUser(session.user_id, {
      projectId: project.id,
      title: "Edit session"
    });
    const parent = await createVersionNodeForUser(session.user_id, {
      projectId: project.id,
      sessionId: creativeSession.id,
      promptSnapshot: "parent",
      paramsSnapshot: {},
      sourceAssetIds: [],
      outputAssetIds: ["asset_parent"],
      status: "succeeded"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("edited-image").toString("base64") }],
            usage: { input_tokens: 15, output_tokens: 25, total_tokens: 40 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    const formData = validEditFormData();
    formData.set("project_id", project.id);
    formData.set("session_id", creativeSession.id);
    formData.set("parent_version_node_id", parent.id);

    const response = await editImage(editRequest(cookie, formData));
    const body = await response.json();
    const task = await getImageTaskForUser(body.data.task_id, session.user_id);
    const nodes = await listVersionNodesForUser(session.user_id, {
      sessionId: creativeSession.id,
      limit: 10
    });
    const child = nodes.items.find((node) => node.id === task?.version_node_id);

    expect(response.status).toBe(200);
    expect(task).toMatchObject({
      project_id: project.id,
      session_id: creativeSession.id,
      version_node_id: expect.stringMatching(/^ver_/)
    });
    expect(child).toMatchObject({
      parent_version_node_id: parent.id,
      status: "succeeded",
      output_asset_ids: body.data.images.map(
        (image: { asset_id: string }) => image.asset_id
      )
    });
  });

  it("lets a database session with a manual key run workbench-context edits", async () => {
    resetDevStore();
    resetAuditLogStore();
    resetRuntimeSettingsStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    setWorkbenchPrismaDouble();
    const { cookie, userId } = await bindDatabaseSession();
    const project = await createWorkbenchProjectForUser(userId, {
      title: "DB edit project"
    });
    const creativeSession = await createCreativeSessionForUser(userId, {
      projectId: project.id,
      title: "DB edit session"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("edited-image").toString("base64") }],
            usage: { input_tokens: 15, output_tokens: 25, total_tokens: 40 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    const formData = validEditFormData();
    formData.set("project_id", project.id);
    formData.set("session_id", creativeSession.id);

    const response = await editImage(editRequest(cookie, formData));
    const body = await response.json();
    const task = await getImageTaskForUser(body.data.task_id, userId);
    const nodes = await listVersionNodesForUser(userId, {
      sessionId: creativeSession.id,
      limit: 10
    });

    expect(response.status).toBe(200);
    expect(task).toMatchObject({
      user_id: userId,
      project_id: project.id,
      session_id: creativeSession.id,
      version_node_id: expect.stringMatching(/^ver_/)
    });
    expect(nodes.items.find((node) => node.id === task?.version_node_id))
      .toMatchObject({
        status: "succeeded",
        output_asset_ids: body.data.images.map(
          (image: { asset_id: string }) => image.asset_id
        )
      });
    expect(JSON.stringify(body)).not.toContain("secret-token-value");
  });

  it("enforces runtime upload size before validating reference images", async () => {
    resetDevStore();
    resetRuntimeSettingsStore();
    resetImageTaskStore();
    const previousMaxUpload = process.env.PSYPIC_MAX_UPLOAD_MB;
    process.env.PSYPIC_MAX_UPLOAD_MB = "1";
    const cookie = await bindSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const formData = validEditFormData();
    const oversizedPng = new Uint8Array(2 * 1024 * 1024);
    oversizedPng.set(pngBytes, 0);
    formData.set(
      "image",
      new File([oversizedPng], "large.png", { type: "image/png" })
    );

    try {
      const response = await editImage(editRequest(cookie, formData));
      const body = await response.json();

      expect(response.status).toBe(413);
      expect(body.error.code).toBe("payload_too_large");
      expect(body.error.details.field).toBe("image");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      restoreEnv("PSYPIC_MAX_UPLOAD_MB", previousMaxUpload);
      resetRuntimeSettingsStore();
    }
  });

  it("rejects missing or invalid reference images before calling Sub2API", async () => {
    resetDevStore();
    resetImageTaskStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const formData = validEditFormData();
    formData.set("image", new File([new Uint8Array([0x48, 0x69])], "note.txt", {
      type: "text/plain"
    }));

    const response = await editImage(editRequest(cookie, formData));
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.error.code).toBe("unsupported_media_type");
    expect(body.error.details.field).toBe("image");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes an optional PNG mask through to Sub2API image edits", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("masked-edit").toString("base64") }],
          usage: { input_tokens: 15, output_tokens: 25, total_tokens: 40 }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);
    const formData = validEditFormData();
    const mask = new File([pngBytes], "mask.png", { type: "image/png" });
    formData.set("mask", mask);

    const response = await editImage(editRequest(cookie, formData));
    const body = await response.json();
    const upstreamFormData = fetchSpy.mock.calls[0][1].body as FormData;

    expect(response.status).toBe(200);
    expect(body.data.task_id).toMatch(/^task_/);
    expect(upstreamFormData.get("mask")).toBe(mask);
  });

  it("forwards multiple reference images to Sub2API image edits", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("multi-edit").toString("base64") }],
          usage: { input_tokens: 20, output_tokens: 25, total_tokens: 45 }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);
    const formData = validEditFormData();
    const first = new File([pngBytes], "product-1.png", { type: "image/png" });
    const second = new File([pngBytes], "product-2.png", { type: "image/png" });
    formData.delete("image");
    formData.append("image", first);
    formData.append("image", second);

    const response = await editImage(editRequest(cookie, formData));
    const body = await response.json();
    const upstreamFormData = fetchSpy.mock.calls[0][1].body as FormData;

    expect(response.status).toBe(200);
    expect(body.data.task_id).toMatch(/^task_/);
    expect(upstreamFormData.getAll("image")).toEqual([first, second]);
  });

  it("rejects invalid masks before calling Sub2API", async () => {
    resetDevStore();
    resetImageTaskStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const formData = validEditFormData();
    formData.set("mask", new File([new Uint8Array([0x48, 0x69])], "mask.txt", {
      type: "text/plain"
    }));

    const response = await editImage(editRequest(cookie, formData));
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.error.code).toBe("unsupported_media_type");
    expect(body.error.details.field).toBe("mask");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects masks whose dimensions do not match the reference image", async () => {
    resetDevStore();
    resetImageTaskStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const formData = validEditFormData();
    formData.set("image", new File([pngWithDimensions(1024, 1024)], "product.png", {
      type: "image/png"
    }));
    formData.set("mask", new File([pngWithDimensions(512, 512)], "mask.png", {
      type: "image/png"
    }));

    const response = await editImage(editRequest(cookie, formData));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_parameter");
    expect(body.error.details.field).toBe("mask");
    expect(body.error.message).toContain("尺寸");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a new edit when the user already has an active image task", async () => {
    resetDevStore();
    resetImageTaskStore();
    const cookie = await bindSession();
    await createRunningTaskForCookie(cookie);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await editImage(editRequest(cookie, validEditFormData()));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.message).toContain("任务正在运行");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function createWorkbenchPrismaDouble() {
  const projects = new Map<string, Record<string, unknown>>();
  const sessions = new Map<string, Record<string, unknown>>();
  const versionNodes = new Map<string, Record<string, unknown>>();

  return {
    workbenchProject: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const row = {
          id: String(data.id),
          userId: String(data.userId),
          title: String(data.title),
          sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
          collapsed: data.collapsed === true,
          activeSessionId:
            typeof data.activeSessionId === "string" ? data.activeSessionId : null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
        projects.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        projects.get(where.id) ?? null,
      findMany: async (input: { where: Record<string, unknown> }) =>
        Array.from(projects.values()).filter((row) => matchesWhere(row, input.where)),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = { ...projects.get(where.id), ...data, updatedAt: new Date() };
        projects.set(where.id, row);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = projects.get(where.id);
        projects.delete(where.id);
        return row;
      }
    },
    creativeSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const row = {
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
          customLabel: null,
          isPinned: false,
          isArchived: false,
          lastReadAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
        sessions.set(row.id, row);
        return attachSessionProject(row, projects);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = sessions.get(where.id);
        return row ? attachSessionProject(row, projects) : null;
      },
      findMany: async (input: { where: Record<string, unknown> }) =>
        Array.from(sessions.values())
          .filter((row) => matchesWhere(row, input.where))
          .map((row) => attachSessionProject(row, projects)),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = { ...sessions.get(where.id), ...data, updatedAt: new Date() };
        sessions.set(where.id, row);
        return attachSessionProject(row, projects);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = sessions.get(where.id);
        sessions.delete(where.id);
        return row ? attachSessionProject(row, projects) : row;
      }
    },
    versionNode: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const row = {
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
          branchLabel: typeof data.branchLabel === "string" ? data.branchLabel : null,
          status: data.status,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
        versionNodes.set(row.id, row);
        return attachNodeRelations(row, projects, sessions);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = versionNodes.get(where.id);
        return row ? attachNodeRelations(row, projects, sessions) : null;
      },
      findMany: async (input: { where: Record<string, unknown>; take: number }) =>
        Array.from(versionNodes.values())
          .filter((row) => matchesWhere(row, input.where))
          .map((row) => attachNodeRelations(row, projects, sessions))
          .slice(0, input.take),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = { ...versionNodes.get(where.id), ...data, updatedAt: new Date() };
        versionNodes.set(where.id, row);
        return attachNodeRelations(row, projects, sessions);
      }
    },
    workbenchSyncMutation: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: String(data.id),
        userId: String(data.userId),
        clientMutationId: String(data.clientMutationId),
        operation: String(data.operation),
        targetType: String(data.targetType),
        targetId: String(data.targetId),
        result: data.result,
        createdAt: new Date()
      }),
      findUnique: async () => null
    }
  };
}

function setWorkbenchPrismaDouble() {
  (
    globalThis as unknown as {
      __psypicWorkbenchPrismaClient: ReturnType<typeof createWorkbenchPrismaDouble>;
    }
  ).__psypicWorkbenchPrismaClient = createWorkbenchPrismaDouble();
}

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function attachSessionProject(
  row: Record<string, unknown>,
  projects: Map<string, Record<string, unknown>>
) {
  return { ...row, project: projects.get(String(row.projectId)) ?? null };
}

function attachNodeRelations(
  row: Record<string, unknown>,
  projects: Map<string, Record<string, unknown>>,
  sessions: Map<string, Record<string, unknown>>
) {
  return {
    ...row,
    project: projects.get(String(row.projectId)) ?? null,
    session: attachSessionProject(
      sessions.get(String(row.sessionId)) ?? {},
      projects
    )
  };
}
