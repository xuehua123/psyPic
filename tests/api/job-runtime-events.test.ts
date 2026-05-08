import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/workbench/job-runtime-events/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { getSession, resetDevStore } from "@/server/services/dev-store";
import {
  cancelImageTaskForUser,
  createImageTask,
  markImageTaskFailed,
  markImageTaskRunning,
  markImageTaskSucceeded,
  resetImageTaskStore
} from "@/server/services/image-task-service";
import {
  recordJobRuntimeEvent,
  resetJobRuntimeEventStore
} from "@/server/services/job-runtime-event-service";

const taskParams = {
  prompt: "Runtime event prompt",
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "medium",
  n: 1,
  output_format: "png",
  output_compression: null,
  background: "auto",
  moderation: "auto"
} as const;

describe("GET /api/workbench/job-runtime-events", () => {
  beforeEach(() => {
    resetDevStore();
    resetImageTaskStore();
    resetJobRuntimeEventStore();
  });

  it("lists task lifecycle events with terminal payloads", async () => {
    const cookie = await bindSession();
    const session = readSession(cookie);
    const task = await createImageTask({
      userId: session.user_id,
      keyBindingId: session.key_binding_id,
      type: "generation",
      prompt: taskParams.prompt,
      params: taskParams
    });
    await markImageTaskRunning(task.id);
    await markImageTaskSucceeded(task.id, {
      images: [
        {
          asset_id: "asset_runtime_1",
          url: "/api/assets/asset_runtime_1",
          format: "png"
        }
      ],
      usage: {
        input_tokens: 1,
        output_tokens: 2,
        total_tokens: 3,
        estimated_cost: "0.0003"
      },
      durationMs: 123,
      upstreamRequestId: "upstream_runtime"
    });

    const response = await GET(
      apiRequest(`/api/workbench/job-runtime-events?task_id=${task.id}`, cookie)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items.map((event: { type: string }) => event.type)).toEqual([
      "queued",
      "running",
      "succeeded"
    ]);
    expect(body.data.items[2]).toMatchObject({
      task_id: task.id,
      version_node_id: null,
      payload: {
        asset_ids: ["asset_runtime_1"],
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          total_tokens: 3,
          estimated_cost: "0.0003"
        },
        upstream_request_id: "upstream_runtime"
      }
    });
  });

  it("redacts failed event payloads and records cancel events", async () => {
    const cookie = await bindSession();
    const session = readSession(cookie);
    const failedTask = await createImageTask({
      userId: session.user_id,
      keyBindingId: session.key_binding_id,
      type: "generation",
      prompt: taskParams.prompt,
      params: taskParams
    });
    await markImageTaskFailed(failedTask.id, {
      code: "upstream_error",
      message: "failed with secret-token-value",
      durationMs: 50
    });
    const canceledTask = await createImageTask({
      userId: session.user_id,
      keyBindingId: session.key_binding_id,
      type: "generation",
      prompt: taskParams.prompt,
      params: taskParams
    });
    await cancelImageTaskForUser(canceledTask.id, session.user_id);

    const failedResponse = await GET(
      apiRequest(
        `/api/workbench/job-runtime-events?task_id=${failedTask.id}`,
        cookie
      )
    );
    const canceledResponse = await GET(
      apiRequest(
        `/api/workbench/job-runtime-events?task_id=${canceledTask.id}`,
        cookie
      )
    );
    const failedBody = await failedResponse.json();
    const canceledBody = await canceledResponse.json();

    expect(failedBody.data.items.at(-1)).toMatchObject({
      type: "failed",
      payload: {
        code: "upstream_error",
        message: expect.not.stringContaining("secret-token-value")
      }
    });
    expect(canceledBody.data.items.at(-1)).toMatchObject({
      type: "canceled"
    });
  });

  it("supports timed_out, partial_image, version node filtering and pagination", async () => {
    const cookie = await bindSession();
    const session = readSession(cookie);
    const task = await createImageTask({
      userId: session.user_id,
      keyBindingId: session.key_binding_id,
      type: "generation",
      prompt: taskParams.prompt,
      params: taskParams
    });
    await recordJobRuntimeEvent({
      userId: session.user_id,
      taskId: task.id,
      versionNodeId: "ver_runtime",
      type: "partial_image",
      payload: { asset_id: "asset_partial", index: 0 }
    });
    await recordJobRuntimeEvent({
      userId: session.user_id,
      taskId: task.id,
      versionNodeId: "ver_runtime",
      type: "timed_out",
      payload: { duration_ms: 300000 }
    });

    const firstPage = await GET(
      apiRequest(
        "/api/workbench/job-runtime-events?version_node_id=ver_runtime&limit=1",
        cookie
      )
    );
    const firstBody = await firstPage.json();
    const secondPage = await GET(
      apiRequest(
        `/api/workbench/job-runtime-events?version_node_id=ver_runtime&limit=2&cursor=${firstBody.data.next_cursor}`,
        cookie
      )
    );
    const secondBody = await secondPage.json();

    expect(firstPage.status).toBe(200);
    expect(firstBody.data.items).toHaveLength(1);
    expect(secondBody.data.items.map((event: { type: string }) => event.type)).toEqual([
      "timed_out"
    ]);
  });

  it("does not expose another user's task events", async () => {
    const ownerCookie = await bindSession();
    const ownerSession = readSession(ownerCookie);
    resetDevStore();
    const otherCookie = await bindSession();
    const task = await createImageTask({
      userId: ownerSession.user_id,
      keyBindingId: ownerSession.key_binding_id,
      type: "generation",
      prompt: taskParams.prompt,
      params: taskParams
    });

    const response = await GET(
      apiRequest(`/api/workbench/job-runtime-events?task_id=${task.id}`, otherCookie)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toEqual([]);
  });
});

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

function readSession(cookie: string) {
  const session = getSession(cookie.replace("psypic_session=", ""));
  if (!session) {
    throw new Error("Expected test session");
  }

  return session;
}

function apiRequest(path: string, cookie: string) {
  return new Request(`http://localhost${path}`, {
    headers: { cookie }
  });
}
