import { describe, expect, it, vi } from "vitest";
import { GET as listLibrary } from "@/app/api/library/route";
import {
  GET as getLibraryAsset,
  PATCH as updateLibraryAsset
} from "@/app/api/library/[assetId]/route";
import { POST as downloadLibraryZip } from "@/app/api/library/zip/route";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { resetDevStore } from "@/server/services/dev-store";
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

function mockImageGeneration() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }],
            usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-request-id": "upstream_library_req_123"
            }
          }
        )
      )
    )
  );
}

describe("GET/PATCH /api/library", () => {
  it("lists generated images as library assets for the current user", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    mockImageGeneration();

    const generationResponse = await generateImage(
      generationRequest(cookie, "Create a clean perfume product photo.")
    );
    const generationBody = await generationResponse.json();

    const response = await listLibrary(
      new Request("http://localhost/api/library?limit=20", {
        headers: { cookie }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      asset_id: generationBody.data.images[0].asset_id,
      task_id: generationBody.data.task_id,
      prompt: "Create a clean perfume product photo.",
      url: generationBody.data.images[0].url,
      thumbnail_url: generationBody.data.images[0].url,
      favorite: false,
      tags: []
    });
    expect(body.data.next_cursor).toBeNull();
    expect(JSON.stringify(body)).not.toContain("secret-token");
    expect(JSON.stringify(body)).not.toContain("api_key");
  });

  it("updates favorite and tags, then filters by favorite and tag", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    mockImageGeneration();

    const generationResponse = await generateImage(
      generationRequest(cookie, "Create an ecommerce hero image.")
    );
    const generationBody = await generationResponse.json();
    const assetId = generationBody.data.images[0].asset_id;

    const updateResponse = await updateLibraryAsset(
      new Request(`http://localhost/api/library/${assetId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          favorite: true,
          tags: ["电商主图", "香水", "香水"]
        })
      }),
      { params: Promise.resolve({ assetId }) }
    );
    const updateBody = await updateResponse.json();

    const favoriteResponse = await listLibrary(
      new Request("http://localhost/api/library?favorite=true&tag=电商主图", {
        headers: { cookie }
      })
    );
    const favoriteBody = await favoriteResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody.data).toMatchObject({
      asset_id: assetId,
      favorite: true,
      tags: ["电商主图", "香水"]
    });
    expect(favoriteBody.data.items).toHaveLength(1);
    expect(favoriteBody.data.items[0]).toMatchObject({
      asset_id: assetId,
      favorite: true,
      tags: ["电商主图", "香水"]
    });
  });

  it("requires an authenticated session", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();

    const response = await listLibrary(new Request("http://localhost/api/library"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });

  it("rejects metadata updates for missing or inaccessible assets", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    const cookie = await bindSession();

    const response = await updateLibraryAsset(
      new Request("http://localhost/api/library/asset_missing", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({ favorite: true })
      }),
      { params: Promise.resolve({ assetId: "asset_missing" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("returns a library asset detail for the current user", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    mockImageGeneration();
    const generationResponse = await generateImage(
      generationRequest(cookie, "Create a product detail image.")
    );
    const generationBody = await generationResponse.json();
    const assetId = generationBody.data.images[0].asset_id;

    const response = await getLibraryAsset(
      new Request(`http://localhost/api/library/${assetId}`, {
        headers: { cookie }
      }),
      { params: Promise.resolve({ assetId }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      asset_id: assetId,
      task_id: generationBody.data.task_id,
      prompt: "Create a product detail image.",
      url: `/api/assets/${assetId}`
    });
  });

  it("downloads selected current-user assets as a zip archive", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    mockImageGeneration();
    const generationResponse = await generateImage(
      generationRequest(cookie, "Create a zip-ready product image.")
    );
    const generationBody = await generationResponse.json();
    const assetId = generationBody.data.images[0].asset_id;

    const response = await downloadLibraryZip(
      new Request("http://localhost/api/library/zip", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({ asset_ids: [assetId] })
      })
    );
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain(
      "psypic-assets.zip"
    );
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});
