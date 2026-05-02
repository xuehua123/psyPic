import { describe, expect, it, vi } from "vitest";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { GET as getTask, POST as cancelTask } from "@/app/api/tasks/[taskId]/route";
import { getSession, resetDevStore } from "@/server/services/dev-store";
import {
  createImageTask,
  resetImageTaskStore
} from "@/server/services/image-task-service";
import { resetTempAssetStore } from "@/server/services/temp-asset-service";

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

function generationRequest(cookie: string) {
  return new Request("http://localhost/api/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie
    },
    body: JSON.stringify({
      prompt: "Create a premium product photo.",
      model: "gpt-image-2",
      size: "1024x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
      background: "auto",
      moderation: "auto"
    })
  });
}

describe("GET/POST /api/tasks/{taskId}", () => {
  it("returns a succeeded task after image generation completes", async () => {
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
              "x-request-id": "upstream_task_req_123"
            }
          }
        )
      )
    );

    const generationResponse = await generateImage(generationRequest(cookie));
    const generationBody = await generationResponse.json();
    const taskId = generationBody.data.task_id;

    const response = await getTask(
      new Request(`http://localhost/api/tasks/${taskId}`, {
        headers: { cookie }
      }),
      { params: Promise.resolve({ taskId }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: taskId,
      status: "succeeded",
      type: "generation",
      upstream_request_id: "upstream_task_req_123",
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30
      }
    });
    expect(body.data.images[0].url).toMatch(/^\/api\/assets\/asset_/);
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });

  it("allows canceling a queued task owned by the current session", async () => {
    resetDevStore();
    resetImageTaskStore();
    const cookie = await bindSession();
    const session = getSession(cookie.replace("psypic_session=", ""));

    if (!session) {
      throw new Error("expected test session");
    }

    const task = await createImageTask({
      userId: session.user_id,
      keyBindingId: session.key_binding_id,
      type: "generation",
      prompt: "Create a premium product photo.",
      params: {
        prompt: "Create a premium product photo.",
        model: "gpt-image-2",
        size: "1024x1024",
        quality: "medium",
        n: 1,
        output_format: "png",
        output_compression: null,
        background: "auto",
        moderation: "auto"
      }
    });

    const response = await cancelTask(
      new Request(`http://localhost/api/tasks/${task.id}`, {
        method: "POST",
        headers: { cookie }
      }),
      { params: Promise.resolve({ taskId: task.id }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("canceled");
  });
});
