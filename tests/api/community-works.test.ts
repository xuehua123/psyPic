import { describe, expect, it, vi } from "vitest";
import { POST as createCommunityWork } from "@/app/api/community/works/route";
import { GET as getCommunityWork } from "@/app/api/community/works/[workId]/route";
import { POST as createSameGenerationDraft } from "@/app/api/community/works/[workId]/same/route";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as saveManualKey } from "@/app/api/settings/manual-key/route";
import { resetDevStore } from "@/server/services/dev-store";
import { resetCommunityWorkStore } from "@/server/services/community-service";
import {
  resetImageLibraryStore,
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

async function bindManualSession() {
  const response = await saveManualKey(
    new Request("http://localhost/api/settings/manual-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        base_url: "https://sub2api.example.com/v1",
        api_key: "secret-token-other-user",
        default_model: "gpt-image-2"
      })
    })
  );

  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

function generationRequest(cookie: string, prompt: string) {
  return new Request("http://localhost/api/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie
    },
    body: JSON.stringify({
      prompt,
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

function createWorkRequest(
  cookie: string,
  input: {
    taskId: string;
    assetId: string;
    visibility?: "private" | "unlisted" | "public";
    disclosePrompt?: boolean;
    allowSameGeneration?: boolean;
    publicConfirmed?: boolean;
  }
) {
  return new Request("http://localhost/api/community/works", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie
    },
    body: JSON.stringify({
      task_id: input.taskId,
      asset_id: input.assetId,
      visibility: input.visibility,
      title: "高级灰香水主图",
      scene: "ecommerce",
      tags: ["电商主图", "香水", "香水"],
      disclose_prompt: input.disclosePrompt ?? false,
      disclose_params: false,
      disclose_reference_images: false,
      allow_same_generation: input.allowSameGeneration ?? true,
      allow_reference_reuse: false,
      public_confirmed: input.publicConfirmed
    })
  });
}

function mockImageGeneration() {
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
            "x-request-id": "upstream_community_req_123"
          }
        }
      )
    )
  );
}

async function seedGeneratedAsset() {
  const cookie = await bindSession();
  mockImageGeneration();
  const generationResponse = await generateImage(
    generationRequest(cookie, "Create a premium ecommerce perfume hero image.")
  );
  const generationBody = await generationResponse.json();

  return {
    cookie,
    taskId: generationBody.data.task_id as string,
    assetId: generationBody.data.images[0].asset_id as string
  };
}

describe("Community works API", () => {
  it("creates a private community work from a current-user generated asset", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    await resetTempAssetStore();
    const { cookie, taskId, assetId } = await seedGeneratedAsset();

    const response = await createCommunityWork(
      createWorkRequest(cookie, {
        taskId,
        assetId,
        visibility: undefined
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      task_id: taskId,
      asset_id: assetId,
      visibility: "private",
      title: "高级灰香水主图",
      scene: "ecommerce",
      tags: ["电商主图", "香水"],
      disclose_prompt: false,
      disclose_params: false,
      disclose_reference_images: false,
      allow_same_generation: true,
      allow_reference_reuse: false
    });
    expect(body.data.work_id).toMatch(/^work_/);
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });

  it("rejects inaccessible task and asset pairs", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    await resetTempAssetStore();
    const { taskId, assetId } = await seedGeneratedAsset();
    const otherCookie = await bindManualSession();

    const response = await createCommunityWork(
      createWorkRequest(otherCookie, { taskId, assetId })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("requires explicit confirmation before publishing public works", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    await resetTempAssetStore();
    const { cookie, taskId, assetId } = await seedGeneratedAsset();

    const response = await createCommunityWork(
      createWorkRequest(cookie, {
        taskId,
        assetId,
        visibility: "public",
        publicConfirmed: false
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "invalid_parameter",
      details: { field: "public_confirmed" }
    });
  });

  it("rejects public publishing when the runtime switch is disabled", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    await resetTempAssetStore();
    process.env.PSYPIC_PUBLIC_PUBLISH_ENABLED = "false";
    const { cookie, taskId, assetId } = await seedGeneratedAsset();

    try {
      const response = await createCommunityWork(
        createWorkRequest(cookie, {
          taskId,
          assetId,
          visibility: "public",
          publicConfirmed: true
        })
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error.code).toBe("public_publish_disabled");
    } finally {
      delete process.env.PSYPIC_PUBLIC_PUBLISH_ENABLED;
    }
  });

  it("does not expose prompt or same-generation draft when privacy switches are off", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    await resetTempAssetStore();
    const { cookie, taskId, assetId } = await seedGeneratedAsset();
    const createResponse = await createCommunityWork(
      createWorkRequest(cookie, {
        taskId,
        assetId,
        visibility: "unlisted",
        disclosePrompt: false,
        allowSameGeneration: false
      })
    );
    const createBody = await createResponse.json();
    const workId = createBody.data.work_id as string;

    const detailResponse = await getCommunityWork(
      new Request(`http://localhost/api/community/works/${workId}`, {
        headers: { cookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    const detailBody = await detailResponse.json();
    const sameResponse = await createSameGenerationDraft(
      new Request(`http://localhost/api/community/works/${workId}/same`, {
        method: "POST",
        headers: { cookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    const sameBody = await sameResponse.json();

    expect(detailResponse.status).toBe(200);
    expect(detailBody.data.prompt).toBeUndefined();
    expect(detailBody.data.same_generation_available).toBe(false);
    expect(JSON.stringify(detailBody)).not.toContain(
      "Create a premium ecommerce perfume hero image."
    );
    expect(sameResponse.status).toBe(403);
    expect(sameBody.error.code).toBe("same_generation_disabled");
  });
});
