import { describe, expect, it, vi } from "vitest";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { resetDevStore } from "@/server/services/dev-store";
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

function generationRequest(cookie: string, body: unknown) {
  return new Request("http://localhost/api/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/images/generations", () => {
  it("generates images through Sub2API and returns TempAsset URLs", async () => {
    resetDevStore();
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
              "x-request-id": "upstream_req_123"
            }
          }
        )
      )
    );

    const response = await generateImage(
      generationRequest(cookie, {
        prompt: "Create a premium product photo.",
        model: "gpt-image-2",
        size: "1024x1024",
        quality: "medium",
        n: 1,
        output_format: "png",
        background: "auto",
        moderation: "auto"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.task_id).toMatch(/^task_/);
    expect(body.data.images[0]).toMatchObject({
      asset_id: expect.stringMatching(/^asset_/),
      url: expect.stringMatching(/^\/api\/assets\/asset_/),
      format: "png"
    });
    expect(body.data.usage).toMatchObject({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30
    });
    expect(body.request_id).toMatch(/^psypic_req_/);
    expect(body.upstream_request_id).toBe("upstream_req_123");
    expect(JSON.stringify(body)).not.toContain("api_key");
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });

  it("rejects invalid parameters before calling Sub2API", async () => {
    resetDevStore();
    const cookie = await bindSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await generateImage(
      generationRequest(cookie, {
        prompt: "",
        size: "1024x1024"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_parameter");
    expect(body.error.details.field).toBe("prompt");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires an authenticated session with a key binding", async () => {
    resetDevStore();

    const response = await generateImage(
      generationRequest("", {
        prompt: "Create a premium product photo."
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });
});
