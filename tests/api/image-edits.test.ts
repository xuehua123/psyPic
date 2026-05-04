import { describe, expect, it, vi } from "vitest";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as editImage } from "@/app/api/images/edits/route";
import {
  listAuditLogs,
  resetAuditLogStore
} from "@/server/services/audit-log-service";
import { getKeyBinding, getSession, resetDevStore } from "@/server/services/dev-store";
import {
  createImageTask,
  markImageTaskRunning,
  resetImageTaskStore
} from "@/server/services/image-task-service";
import { resetRuntimeSettingsStore } from "@/server/services/runtime-settings-service";
import { resetTempAssetStore } from "@/server/services/temp-asset-service";

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
