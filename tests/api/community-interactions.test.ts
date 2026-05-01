import { describe, expect, it, vi } from "vitest";
import {
  GET as listCommunityWorks,
  POST as createCommunityWork
} from "@/app/api/community/works/route";
import { GET as getCommunityWork } from "@/app/api/community/works/[workId]/route";
import {
  DELETE as deleteFavorite,
  POST as createFavorite
} from "@/app/api/community/works/[workId]/favorite/route";
import {
  DELETE as deleteLike,
  POST as createLike
} from "@/app/api/community/works/[workId]/like/route";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as saveManualKey } from "@/app/api/settings/manual-key/route";
import { resetDevStore } from "@/server/services/dev-store";
import {
  resetCommunityInteractionStore,
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
        api_key: "secret-token-community-interaction",
        default_model: "gpt-image-2"
      })
    })
  );

  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
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
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )
  );
}

async function seedWork(visibility: "private" | "public" = "public") {
  const cookie = await bindSession();
  mockImageGeneration();
  const generationResponse = await generateImage(
    new Request("http://localhost/api/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        prompt: "Create a community interaction image.",
        model: "gpt-image-2",
        size: "1024x1024",
        quality: "medium",
        n: 1,
        output_format: "png",
        background: "auto",
        moderation: "auto"
      })
    })
  );
  const generationBody = await generationResponse.json();
  const workResponse = await createCommunityWork(
    new Request("http://localhost/api/community/works", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        task_id: generationBody.data.task_id,
        asset_id: generationBody.data.images[0].asset_id,
        visibility,
        public_confirmed: visibility === "public",
        title: "互动测试作品",
        scene: "ecommerce",
        tags: ["电商主图", "互动"],
        disclose_prompt: false,
        disclose_params: false,
        disclose_reference_images: false,
        allow_same_generation: true,
        allow_reference_reuse: false
      })
    })
  );
  const workBody = await workResponse.json();

  return {
    ownerCookie: cookie,
    workId: workBody.data.work_id as string
  };
}

async function resetStores() {
  resetDevStore();
  resetImageTaskStore();
  resetImageLibraryStore();
  resetCommunityWorkStore();
  resetCommunityInteractionStore();
  await resetTempAssetStore();
}

describe("Community interaction API", () => {
  it("likes and favorites visible works idempotently for the current user", async () => {
    await resetStores();
    const { workId } = await seedWork("public");
    const viewerCookie = await bindManualSession();

    const firstLike = await createLike(
      new Request(`http://localhost/api/community/works/${workId}/like`, {
        method: "POST",
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    await createLike(
      new Request(`http://localhost/api/community/works/${workId}/like`, {
        method: "POST",
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    const favorite = await createFavorite(
      new Request(`http://localhost/api/community/works/${workId}/favorite`, {
        method: "POST",
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    const detailResponse = await getCommunityWork(
      new Request(`http://localhost/api/community/works/${workId}`, {
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    const detailBody = await detailResponse.json();

    expect(firstLike.status).toBe(200);
    expect(favorite.status).toBe(200);
    expect(detailBody.data).toMatchObject({
      like_count: 1,
      favorite_count: 1,
      liked: true,
      favorited: true
    });
    expect(JSON.stringify(detailBody)).not.toContain("secret-token");
  });

  it("removes likes and favorites without deleting the community work", async () => {
    await resetStores();
    const { workId } = await seedWork("public");
    const viewerCookie = await bindManualSession();

    await createLike(
      new Request(`http://localhost/api/community/works/${workId}/like`, {
        method: "POST",
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    await createFavorite(
      new Request(`http://localhost/api/community/works/${workId}/favorite`, {
        method: "POST",
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    await deleteLike(
      new Request(`http://localhost/api/community/works/${workId}/like`, {
        method: "DELETE",
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    await deleteFavorite(
      new Request(`http://localhost/api/community/works/${workId}/favorite`, {
        method: "DELETE",
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    const detailResponse = await getCommunityWork(
      new Request(`http://localhost/api/community/works/${workId}`, {
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    const detailBody = await detailResponse.json();

    expect(detailResponse.status).toBe(200);
    expect(detailBody.data).toMatchObject({
      like_count: 0,
      favorite_count: 0,
      liked: false,
      favorited: false
    });
  });

  it("returns 404 when interacting with inaccessible private works", async () => {
    await resetStores();
    const { workId } = await seedWork("private");
    const viewerCookie = await bindManualSession();

    const response = await createFavorite(
      new Request(`http://localhost/api/community/works/${workId}/favorite`, {
        method: "POST",
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("returns viewer interaction state in public list responses", async () => {
    await resetStores();
    const { workId } = await seedWork("public");
    const viewerCookie = await bindManualSession();
    await createLike(
      new Request(`http://localhost/api/community/works/${workId}/like`, {
        method: "POST",
        headers: { cookie: viewerCookie }
      }),
      { params: Promise.resolve({ workId }) }
    );

    const response = await listCommunityWorks(
      new Request("http://localhost/api/community/works?tag=互动&sort=popular", {
        headers: { cookie: viewerCookie }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items[0]).toMatchObject({
      work_id: workId,
      like_count: 1,
      favorite_count: 0,
      liked: true,
      favorited: false
    });
  });
});
