import { describe, expect, it, vi } from "vitest";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as editImage } from "@/app/api/images/edits/route";
import { resetDevStore } from "@/server/services/dev-store";
import { resetTempAssetStore } from "@/server/services/temp-asset-service";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
  formData.set("prompt", "Keep the product unchanged and replace the background.");
  formData.set("model", "gpt-image-2");
  formData.set("size", "1024x1024");
  formData.set("quality", "medium");
  formData.set("n", "1");
  formData.set("output_format", "png");
  formData.set("background", "auto");
  formData.set("moderation", "auto");
  formData.set("image", new File([pngBytes], "product.png", { type: "image/png" }));

  return formData;
}

describe("POST /api/images/edits", () => {
  it("edits a single reference image through Sub2API and returns TempAsset URLs", async () => {
    resetDevStore();
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
  });

  it("rejects missing or invalid reference images before calling Sub2API", async () => {
    resetDevStore();
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
});
