import { describe, expect, it, vi } from "vitest";
import { POST as createCommunityWork } from "@/app/api/community/works/route";
import { GET as getCommunityWork } from "@/app/api/community/works/[workId]/route";
import { POST as createCommunityReport } from "@/app/api/community/reports/route";
import { POST as takeDownCommunityWork } from "@/app/api/admin/community/works/[workId]/take-down/route";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as saveManualKey } from "@/app/api/settings/manual-key/route";
import {
  createAdminSessionForDev,
  resetDevStore
} from "@/server/services/dev-store";
import {
  resetCommunityReportStore,
  resetCommunityWorkStore
} from "@/server/services/community-service";
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
        api_key: "secret-token-reporter",
        default_model: "gpt-image-2"
      })
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
      prompt: "Create a public community moderation image.",
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
          headers: { "content-type": "application/json" }
        }
      )
    )
  );
}

async function seedPublicWork() {
  const cookie = await bindSession();
  mockImageGeneration();
  const generationResponse = await generateImage(generationRequest(cookie));
  const generationBody = await generationResponse.json();
  const createResponse = await createCommunityWork(
    new Request("http://localhost/api/community/works", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        task_id: generationBody.data.task_id,
        asset_id: generationBody.data.images[0].asset_id,
        visibility: "public",
        public_confirmed: true,
        title: "可举报公开作品",
        scene: "ecommerce",
        tags: ["电商主图"],
        disclose_prompt: false,
        disclose_params: false,
        disclose_reference_images: false,
        allow_same_generation: true,
        allow_reference_reuse: false
      })
    })
  );
  const createBody = await createResponse.json();

  return {
    ownerCookie: cookie,
    workId: createBody.data.work_id as string
  };
}

describe("Community moderation API", () => {
  it("lets an authenticated user report a visible community work", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    resetCommunityReportStore();
    await resetTempAssetStore();
    const { workId } = await seedPublicWork();
    const reporterCookie = await bindManualSession();

    const response = await createCommunityReport(
      new Request("http://localhost/api/community/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: reporterCookie
        },
        body: JSON.stringify({
          work_id: workId,
          reason: "privacy",
          details: "疑似包含不应公开的商品素材。"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      work_id: workId,
      reason: "privacy",
      status: "open"
    });
    expect(body.data.report_id).toMatch(/^report_/);
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });

  it("requires admin role to take down a community work", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    resetCommunityReportStore();
    await resetTempAssetStore();
    const { workId } = await seedPublicWork();
    const regularCookie = await bindManualSession();

    const response = await takeDownCommunityWork(
      new Request(
        `http://localhost/api/admin/community/works/${workId}/take-down`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: regularCookie
          },
          body: JSON.stringify({ reason: "privacy" })
        }
      ),
      { params: Promise.resolve({ workId }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("forbidden");
  });

  it("hides a taken-down community work from public detail responses", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    resetCommunityReportStore();
    await resetTempAssetStore();
    const { workId } = await seedPublicWork();
    const admin = createAdminSessionForDev();
    const adminCookie = `psypic_session=${admin.session.id}`;

    const takeDownResponse = await takeDownCommunityWork(
      new Request(
        `http://localhost/api/admin/community/works/${workId}/take-down`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: adminCookie
          },
          body: JSON.stringify({ reason: "unsafe" })
        }
      ),
      { params: Promise.resolve({ workId }) }
    );
    const takeDownBody = await takeDownResponse.json();
    const detailResponse = await getCommunityWork(
      new Request(`http://localhost/api/community/works/${workId}`),
      { params: Promise.resolve({ workId }) }
    );
    const detailBody = await detailResponse.json();

    expect(takeDownResponse.status).toBe(200);
    expect(takeDownBody.data.review_status).toBe("taken_down");
    expect(detailResponse.status).toBe(404);
    expect(detailBody.error.code).toBe("not_found");
  });
});
