import { describe, expect, it, vi } from "vitest";
import { GET as getBatch } from "@/app/api/batches/[batchId]/route";
import { POST as retryBatch } from "@/app/api/batches/[batchId]/retry/route";
import { POST as createBatches } from "@/app/api/batches/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { getSession, resetDevStore } from "@/server/services/dev-store";
import {
  getImageBatchForUser,
  markBatchItemFailed,
  resetImageBatchStore
} from "@/server/services/image-batch-service";
import { resetImageJobQueueStore } from "@/server/services/image-job-queue-service";
import {
  getImageTaskForUser,
  resetImageTaskStore
} from "@/server/services/image-task-service";
import {
  listAuditLogs,
  resetAuditLogStore
} from "@/server/services/audit-log-service";
import { resetTempAssetStore } from "@/server/services/temp-asset-service";
import { resetRuntimeSettingsStore } from "@/server/services/runtime-settings-service";

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

async function resetStores() {
  resetDevStore();
  resetAuditLogStore();
  resetImageTaskStore();
  resetImageJobQueueStore();
  resetImageBatchStore();
  resetRuntimeSettingsStore();
  await resetTempAssetStore();
}

describe("image batches API", () => {
  it("creates queued batch items from prompts and multiple sizes", async () => {
    await resetStores();
    const cookie = await bindSession();

    const response = await createBatches(
      new Request("http://localhost/api/batches", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          prompts: ["香水主图", "口红主图"],
          sizes: ["1024x1024", "1536x1024"],
          params: {
            model: "gpt-image-2",
            quality: "medium",
            output_format: "png",
            background: "auto",
            moderation: "auto"
          }
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("queued");
    expect(body.data.items).toHaveLength(4);
    expect(body.data.items[0]).toMatchObject({
      prompt: "香水主图",
      size: "1024x1024",
      status: "queued"
    });
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });

  it("creates batch items from CSV rows", async () => {
    await resetStores();
    const cookie = await bindSession();

    const response = await createBatches(
      new Request("http://localhost/api/batches", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          csv: "prompt,size\n香水主图,1024x1024\n口红横幅,1536x1024",
          params: {
            model: "gpt-image-2",
            quality: "medium",
            output_format: "png",
            background: "auto",
            moderation: "auto"
          }
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[1]).toMatchObject({
      prompt: "口红横幅",
      size: "1536x1024"
    });
  });

  it("processes queued batch items through Sub2API", async () => {
    await resetStores();
    const cookie = await bindSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("batch-image").toString("base64") }],
            usage: { input_tokens: 8, output_tokens: 16, total_tokens: 24 }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-request-id": "upstream_batch_req"
            }
          }
        )
      )
    );

    const response = await createBatches(
      new Request("http://localhost/api/batches", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          prompts: ["香水主图"],
          sizes: ["1024x1024"],
          params: {
            model: "gpt-image-2",
            quality: "medium",
            output_format: "png",
            background: "auto",
            moderation: "auto"
          }
        })
      })
    );
    const createBody = await response.json();
    const batchId = createBody.data.batch_id as string;
    const settledBatch = await waitForBatchStatus(cookie, batchId, "succeeded");

    expect(settledBatch.status).toBe("succeeded");
    expect(settledBatch.items[0]).toMatchObject({
      status: "succeeded"
    });
    const auditLogs = await listAuditLogs({ limit: 10 });
    expect(auditLogs.items[0]).toMatchObject({
      action: "image_generation.succeeded",
      target_id: settledBatch.items[0].task_id,
      metadata: expect.objectContaining({
        mode: "batch",
        upstream_request_id: "upstream_batch_req"
      })
    });
  });

  it("enforces runtime limits before creating batch items", async () => {
    await resetStores();
    const previousSizeTier = process.env.PSYPIC_MAX_SIZE_TIER;
    process.env.PSYPIC_MAX_SIZE_TIER = "2K";
    const cookie = await bindSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    try {
      const response = await createBatches(
        new Request("http://localhost/api/batches", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie
          },
          body: JSON.stringify({
            prompts: ["超大海报"],
            sizes: ["4096x2048"],
            params: {
              model: "gpt-image-2",
              quality: "medium",
              output_format: "png",
              background: "auto",
              moderation: "auto"
            }
          })
        })
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.details.field).toBe("size");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      restoreEnv("PSYPIC_MAX_SIZE_TIER", previousSizeTier);
      resetRuntimeSettingsStore();
    }
  });

  it("starts processing after batch creation without relying on GET polling", async () => {
    await resetStores();
    const cookie = await bindSession();
    const sessionId = cookie.replace("psypic_session=", "");
    const session = getSession(sessionId);
    if (!session) {
      throw new Error("expected session");
    }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("batch-image").toString("base64") }],
            usage: { input_tokens: 8, output_tokens: 16, total_tokens: 24 }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-request-id": "upstream_batch_req"
            }
          }
        )
      )
    );

    const response = await createBatches(
      new Request("http://localhost/api/batches", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          prompts: ["香水主图"],
          sizes: ["1024x1024"],
          params: {
            model: "gpt-image-2",
            quality: "medium",
            output_format: "png",
            background: "auto",
            moderation: "auto"
          }
        })
      })
    );
    const createBody = await response.json();
    const batchId = createBody.data.batch_id as string;
    const settledBatch = await waitForStoredBatchStatus(
      session.user_id,
      batchId,
      "succeeded"
    );

    expect(settledBatch.status).toBe("succeeded");
    expect(settledBatch.items[0].status).toBe("succeeded");
  });

  it("retries failed batch items with new queued tasks and original params", async () => {
    await resetStores();
    const cookie = await bindSession();
    const sessionId = cookie.replace("psypic_session=", "");
    const createResponse = await createBatches(
      new Request("http://localhost/api/batches", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          prompts: ["香水主图"],
          sizes: ["1024x1024"],
          params: {
            model: "gpt-image-2",
            quality: "high",
            output_format: "jpeg",
            output_compression: 75,
            background: "auto",
            moderation: "auto"
          }
        })
      })
    );
    const createBody = await createResponse.json();
    const batchId = createBody.data.batch_id as string;
    const itemId = createBody.data.items[0].item_id as string;
    const originalTaskId = createBody.data.items[0].task_id as string;
    markBatchItemFailed(batchId, itemId, {
      code: "upstream_error",
      message: "上游失败"
    });

    const retryResponse = await retryBatch(
      new Request(`http://localhost/api/batches/${batchId}/retry`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({ item_ids: [itemId] })
      }),
      { params: Promise.resolve({ batchId }) }
    );
    const retryBody = await retryResponse.json();
    const getResponse = await getBatch(
      new Request(`http://localhost/api/batches/${batchId}`, {
        headers: { cookie }
      }),
      { params: Promise.resolve({ batchId }) }
    );
    const getBody = await getResponse.json();

    expect(retryResponse.status).toBe(200);
    expect(retryBody.data.items[0].status).toBe("queued");
    expect(retryBody.data.items[0].task_id).not.toBe(originalTaskId);
    expect(getBody.data.items[0].retry_count).toBe(1);
    const session = getSession(sessionId);
    if (!session) {
      throw new Error("expected session");
    }
    const retriedTask = await getImageTaskForUser(
      retryBody.data.items[0].task_id,
      session.user_id
    );
    expect(retriedTask?.params).toMatchObject({
      quality: "high",
      output_format: "jpeg",
      output_compression: 75
    });
  });

  it("does not expose batches across users", async () => {
    await resetStores();
    const ownerCookie = await bindSession();
    const createResponse = await createBatches(
      new Request("http://localhost/api/batches", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: ownerCookie
        },
        body: JSON.stringify({
          prompts: ["香水主图"],
          sizes: ["1024x1024"],
          params: {
            model: "gpt-image-2",
            quality: "medium",
            output_format: "png",
            background: "auto",
            moderation: "auto"
          }
        })
      })
    );
    const createBody = await createResponse.json();
    resetDevStore();
    const otherCookie = await bindSession();

    const response = await getBatch(
      new Request(`http://localhost/api/batches/${createBody.data.batch_id}`, {
        headers: { cookie: otherCookie }
      }),
      { params: Promise.resolve({ batchId: createBody.data.batch_id }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

async function waitForBatchStatus(
  cookie: string,
  batchId: string,
  status: string
) {
  for (let index = 0; index < 20; index += 1) {
    const response = await getBatch(
      new Request(`http://localhost/api/batches/${batchId}`, {
        headers: { cookie }
      }),
      { params: Promise.resolve({ batchId }) }
    );
    const body = await response.json();

    if (body.data?.status === status) {
      return body.data;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`expected batch ${batchId} to reach ${status}`);
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

async function waitForStoredBatchStatus(
  userId: string,
  batchId: string,
  status: string
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const batch = getImageBatchForUser(batchId, userId);

    if (batch?.status === status) {
      return batch;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`expected stored batch ${batchId} to reach ${status}`);
}
