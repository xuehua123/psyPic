import { describe, expect, it, vi } from "vitest";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { GET as listAlbums, POST as createAlbum } from "@/app/api/albums/route";
import { resetDevStore } from "@/server/services/dev-store";
import {
  resetImageAlbumStore,
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

describe("GET/POST /api/albums", () => {
  it("creates and lists albums for the current user", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageLibraryStore();
    resetImageAlbumStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    mockImageGeneration();
    const generationResponse = await generateImage(
      generationRequest(cookie, "Create an album product image.")
    );
    const generationBody = await generationResponse.json();
    const assetId = generationBody.data.images[0].asset_id;

    const createResponse = await createAlbum(
      new Request("http://localhost/api/albums", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          title: "香水主图项目",
          asset_ids: [assetId]
        })
      })
    );
    const createBody = await createResponse.json();
    const listResponse = await listAlbums(
      new Request("http://localhost/api/albums", {
        headers: { cookie }
      })
    );
    const listBody = await listResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createBody.data).toMatchObject({
      title: "香水主图项目",
      asset_ids: [assetId],
      asset_count: 1
    });
    expect(listBody.data.items).toHaveLength(1);
    expect(listBody.data.items[0]).toMatchObject({
      id: createBody.data.id,
      title: "香水主图项目",
      asset_count: 1
    });
  });

  it("requires authentication", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageAlbumStore();

    const response = await listAlbums(new Request("http://localhost/api/albums"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });
});
