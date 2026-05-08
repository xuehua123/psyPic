import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { getKeyBinding, getSession, resetDevStore } from "@/server/services/dev-store";
import {
  cancelImageTaskForUser,
  createImageTask,
  getImageTaskForUser,
  markImageTaskRunning,
  resetImageTaskStore
} from "@/server/services/image-task-service";
import { resetTempAssetStore } from "@/server/services/temp-asset-service";
import { resetRuntimeSettingsStore } from "@/server/services/runtime-settings-service";
import { createCreativeSessionForUser } from "@/server/services/creative-session-service";
import { listVersionNodesForUser } from "@/server/services/version-node-service";
import { createWorkbenchProjectForUser } from "@/server/services/workbench-project-service";

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

function generationRequest(cookie: string, body: unknown) {
  return new Request("http://localhost/api/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie
    },
    body: JSON.stringify(body)
  });
}

function deferredGenerationRequest(
  cookie: string,
  body: unknown,
  parseReady: Promise<void>
) {
  const request = generationRequest(cookie, body);
  Object.defineProperty(request, "json", {
    value: () => parseReady.then(() => body)
  });

  return request;
}

const validGenerationBody = {
  prompt: "Create a premium product photo.",
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "medium",
  n: 1,
  output_format: "png",
  output_compression: null,
  background: "auto",
  moderation: "auto"
} as const;

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
    prompt: validGenerationBody.prompt,
    params: validGenerationBody
  });
  await markImageTaskRunning(task.id);
}

describe("POST /api/images/generations", () => {
  beforeEach(() => {
    resetRuntimeSettingsStore();
  });

  it("generates images through Sub2API and returns TempAsset URLs", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }],
            usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-request-id": "upstream_req_123"
            }
          }
        )
      )
    );

    const response = await generateImage(
      generationRequest(cookie, validGenerationBody)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.task_id).toMatch(/^task_/);
    expect(body.data.images[0]).toMatchObject({
      asset_id: expect.stringMatching(/^asset_/),
      url: expect.stringMatching(/^\/api\/assets\/asset_/),
      format: "png"
    });
    expect(body.data.usage).toMatchObject({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30
    });
    expect(body.request_id).toMatch(/^psypic_req_/);
    expect(body.upstream_request_id).toBe("upstream_req_123");
    expect(JSON.stringify(body)).not.toContain("api_key");
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });

  it("links context-aware generations to a workbench version node", async () => {
    resetDevStore();
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
      title: "Generation project"
    });
    const creativeSession = await createCreativeSessionForUser(session.user_id, {
      projectId: project.id,
      title: "Generation session"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }],
            usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const response = await generateImage(
      generationRequest(cookie, {
        ...validGenerationBody,
        project_id: project.id,
        session_id: creativeSession.id
      })
    );
    const body = await response.json();
    const task = await getImageTaskForUser(body.data.task_id, session.user_id);
    const nodes = await listVersionNodesForUser(session.user_id, {
      sessionId: creativeSession.id
    });

    expect(response.status).toBe(200);
    expect(task).toMatchObject({
      project_id: project.id,
      session_id: creativeSession.id,
      version_node_id: expect.stringMatching(/^ver_/)
    });
    expect(nodes.items).toHaveLength(1);
    expect(nodes.items[0]).toMatchObject({
      id: task?.version_node_id,
      project_id: project.id,
      session_id: creativeSession.id,
      prompt_snapshot: validGenerationBody.prompt,
      status: "succeeded",
      output_asset_ids: body.data.images.map(
        (image: { asset_id: string }) => image.asset_id
      )
    });
  });

  it("rejects workbench context owned by another user before calling Sub2API", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    setWorkbenchPrismaDouble();
    const cookie = await bindSession();
    const foreignProject = await createWorkbenchProjectForUser("user_foreign", {
      title: "Foreign project"
    });
    const foreignSession = await createCreativeSessionForUser("user_foreign", {
      projectId: foreignProject.id,
      title: "Foreign session"
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await generateImage(
      generationRequest(cookie, {
        ...validGenerationBody,
        project_id: foreignProject.id,
        session_id: foreignSession.id
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("forbidden");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("syncs failed and canceled image tasks back to linked version nodes", async () => {
    resetDevStore();
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
      title: "Lifecycle project"
    });
    const failedSession = await createCreativeSessionForUser(session.user_id, {
      projectId: project.id,
      title: "Failed session"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "upstream failed" } }), {
          status: 500,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const failedResponse = await generateImage(
      generationRequest(cookie, {
        ...validGenerationBody,
        project_id: project.id,
        session_id: failedSession.id
      })
    );
    const failedNodes = await listVersionNodesForUser(session.user_id, {
      sessionId: failedSession.id
    });
    const canceledSession = await createCreativeSessionForUser(session.user_id, {
      projectId: project.id,
      title: "Canceled session"
    });
    const task = await createImageTask({
      userId: session.user_id,
      keyBindingId: session.key_binding_id,
      type: "generation",
      prompt: validGenerationBody.prompt,
      params: validGenerationBody,
      workbenchContext: {
        projectId: project.id,
        sessionId: canceledSession.id
      }
    });
    await markImageTaskRunning(task.id);
    await cancelImageTaskForUser(task.id, session.user_id);
    const canceledNodes = await listVersionNodesForUser(session.user_id, {
      sessionId: canceledSession.id
    });

    expect(failedResponse.status).toBe(500);
    expect(failedNodes.items[0]).toMatchObject({ status: "failed" });
    expect(canceledNodes.items[0]).toMatchObject({ status: "canceled" });
  });

  it("rejects invalid parameters before calling Sub2API", async () => {
    resetDevStore();
    resetImageTaskStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await generateImage(
      generationRequest(cookie, {
        prompt: "",
        size: "1024x1024"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_parameter");
    expect(body.error.details.field).toBe("prompt");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns an actionable message when Sub2API rejects the configured key", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 401,
          headers: {
            "content-type": "application/json",
            "x-request-id": "upstream_auth_req_123"
          }
        })
      )
    );

    const response = await generateImage(
      generationRequest(cookie, validGenerationBody)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
    expect(body.error.message).toContain("Sub2API Key");
    expect(body.error.message).toContain("Base URL");
    expect(body.upstream_request_id).toBe("upstream_auth_req_123");
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });

  it("normalizes upstream 500 without leaking the upstream error body", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "server failed with secret-token-value" }
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json",
              "x-request-id": "upstream_error_req_123"
            }
          }
        )
      )
    );

    const response = await generateImage(
      generationRequest(cookie, validGenerationBody)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("upstream_error");
    expect(body.upstream_request_id).toBe("upstream_error_req_123");
    expect(JSON.stringify(body)).not.toContain("secret-token-value");
  });

  it("requires an authenticated session with a key binding", async () => {
    resetDevStore();
    resetImageTaskStore();

    const response = await generateImage(
      generationRequest("", {
        prompt: "Create a premium product photo."
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });

  it("rejects a new generation when the user already has an active image task", async () => {
    resetDevStore();
    resetImageTaskStore();
    const cookie = await bindSession();
    await createRunningTaskForCookie(cookie);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await generateImage(
      generationRequest(cookie, validGenerationBody)
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.message).toContain("任务正在运行");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("enforces the runtime max_n limit before calling Sub2API", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetRuntimeSettingsStore();
    process.env.PSYPIC_MAX_IMAGE_N = "1";
    const cookie = await bindSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    try {
      const response = await generateImage(
        generationRequest(cookie, {
          ...validGenerationBody,
          n: 2
        })
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "invalid_parameter",
        details: { field: "n" }
      });
      expect(body.error.message).toContain("1");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      delete process.env.PSYPIC_MAX_IMAGE_N;
    }
  });

  it("passes JPEG output compression through to Sub2API", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("jpeg-image").toString("base64") }],
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await generateImage(
      generationRequest(cookie, {
        ...validGenerationBody,
        output_format: "jpeg",
        output_compression: 80
      })
    );
    const payload = JSON.parse(fetchSpy.mock.calls[0][1].body as string);

    expect(response.status).toBe(200);
    expect(payload.output_format).toBe("jpeg");
    expect(payload.output_compression).toBe(80);
  });

  it("normalizes custom dimensions to multiples of 16 before Sub2API", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("custom-size").toString("base64") }],
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await generateImage(
      generationRequest(cookie, {
        ...validGenerationBody,
        size: "1501x999"
      })
    );
    const payload = JSON.parse(fetchSpy.mock.calls[0][1].body as string);

    expect(response.status).toBe(200);
    expect(payload.size).toBe("1504x992");
  });

  it("rejects custom dimensions beyond ratio and size limits", async () => {
    resetDevStore();
    resetImageTaskStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await generateImage(
      generationRequest(cookie, {
        ...validGenerationBody,
        size: "4096x512"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_parameter");
    expect(body.error.details.field).toBe("size");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not let concurrent generation requests both pass the active task check", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    let releaseParse: (() => void) | undefined;
    const parseReady = new Promise<void>((resolve) => {
      releaseParse = resolve;
    });
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }],
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const first = generateImage(
      deferredGenerationRequest(cookie, validGenerationBody, parseReady)
    );
    const second = generateImage(
      deferredGenerationRequest(cookie, validGenerationBody, parseReady)
    );
    await Promise.resolve();
    releaseParse?.();
    const responses = await Promise.all([first, second]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map((response) => response.status).sort()).toEqual([
      200,
      429
    ]);
    expect(bodies.some((body) => body.error?.code === "rate_limited")).toBe(
      true
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

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
      findMany: async (input: {
        where: Record<string, unknown>;
        take: number;
      }) =>
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
