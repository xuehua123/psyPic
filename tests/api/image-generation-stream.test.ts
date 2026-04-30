import { describe, expect, it, vi } from "vitest";
import { POST as streamGenerateImage } from "@/app/api/images/generations/stream/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { GET as getTask } from "@/app/api/tasks/[taskId]/route";
import { getKeyBinding, getSession, resetDevStore } from "@/server/services/dev-store";
import {
  createImageTask,
  markImageTaskRunning,
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

function streamRequest(cookie: string) {
  return new Request("http://localhost/api/images/generations/stream", {
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
      moderation: "auto",
      stream: true,
      partial_images: 2
    })
  });
}

const validTaskParams = {
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

function createRunningTaskForCookie(cookie: string) {
  const sessionId = cookie.replace("psypic_session=", "");
  const session = getSession(sessionId);

  if (!session) {
    throw new Error("Expected test session");
  }

  const binding = getKeyBinding(session.key_binding_id);

  if (!binding) {
    throw new Error("Expected test key binding");
  }

  const task = createImageTask({
    userId: session.user_id,
    keyBindingId: binding.id,
    type: "generation",
    prompt: validTaskParams.prompt,
    params: validTaskParams
  });
  markImageTaskRunning(task.id);
}

describe("POST /api/images/generations/stream", () => {
  it("proxies partial image events and persists the completed task", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    const partialBytes = Buffer.from("partial-image-bytes").toString("base64");
    const finalBytes = Buffer.from("final-image-bytes").toString("base64");
    const upstreamSse = [
      "event: image_generation.partial_image",
      `data: ${JSON.stringify({
        type: "image_generation.partial_image",
        b64_json: partialBytes,
        partial_image_index: 0
      })}`,
      "",
      "event: image_generation.completed",
      `data: ${JSON.stringify({
        type: "image_generation.completed",
        b64_json: finalBytes,
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
      })}`,
      "",
      ""
    ].join("\n");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(upstreamSse, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-request-id": "upstream_stream_req_123"
        }
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await streamGenerateImage(streamRequest(cookie));
    const text = await response.text();
    const events = parseSse(text);
    const started = events.find((event) => event.event === "task_started");
    const partial = events.find((event) => event.event === "partial_image");
    const completed = events.find((event) => event.event === "completed");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(started?.data.task_id).toMatch(/^task_/);
    expect(partial?.data).toMatchObject({
      task_id: started?.data.task_id,
      index: 0,
      url: expect.stringMatching(/^\/api\/assets\/asset_/)
    });
    expect(completed?.data).toMatchObject({
      task_id: started?.data.task_id,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30
      }
    });
    expect(completed?.data.images[0].url).toMatch(/^\/api\/assets\/asset_/);
    expect(JSON.stringify(events)).not.toContain("secret-token");
    expect(JSON.stringify(events)).not.toContain("api_key");

    const upstreamBody = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(upstreamBody).toMatchObject({
      stream: true,
      partial_images: 2,
      prompt: "Create a premium product photo."
    });

    const taskResponse = await getTask(
      new Request(`http://localhost/api/tasks/${started?.data.task_id}`, {
        headers: { cookie }
      }),
      { params: Promise.resolve({ taskId: started?.data.task_id }) }
    );
    const taskBody = await taskResponse.json();
    expect(taskBody.data).toMatchObject({
      id: started?.data.task_id,
      status: "succeeded",
      upstream_request_id: "upstream_stream_req_123"
    });
    expect(taskBody.data.images[0].url).toMatch(/^\/api\/assets\/asset_/);
  });

  it("rejects a new stream when the user already has an active image task", async () => {
    resetDevStore();
    resetImageTaskStore();
    const cookie = await bindSession();
    createRunningTaskForCookie(cookie);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await streamGenerateImage(streamRequest(cookie));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.message).toContain("任务正在运行");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function parseSse(text: string) {
  return text
    .trim()
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split("\n");
      const event = lines
        .find((line) => line.startsWith("event: "))
        ?.replace("event: ", "");
      const dataLine = lines
        .find((line) => line.startsWith("data: "))
        ?.replace("data: ", "");

      return {
        event,
        data: dataLine ? JSON.parse(dataLine) : {}
      };
    });
}
