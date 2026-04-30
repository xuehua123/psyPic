import { describe, expect, it, vi } from "vitest";
import { GET as getUsage } from "@/app/api/usage/route";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as saveManualKey } from "@/app/api/settings/manual-key/route";
import { resetDevStore } from "@/server/services/dev-store";
import { resetImageTaskStore } from "@/server/services/image-task-service";
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
        api_key: "secret-token-usage-other-user",
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

describe("GET /api/usage", () => {
  it("summarizes succeeded image usage for the current user only", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
    const otherCookie = await bindManualSession();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }],
              usage: {
                input_tokens: 10,
                output_tokens: 20,
                total_tokens: 30,
                estimated_cost: "0.1200"
              }
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" }
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: [{ b64_json: Buffer.from("other-user").toString("base64") }],
              usage: {
                input_tokens: 900,
                output_tokens: 100,
                total_tokens: 1000,
                estimated_cost: "9.0000"
              }
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" }
            }
          )
        )
    );

    await generateImage(generationRequest(cookie, "Create a usage test image."));
    await generateImage(
      generationRequest(otherCookie, "Create another user's usage image.")
    );

    const response = await getUsage(
      new Request("http://localhost/api/usage", {
        headers: { cookie }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      task_count: 1,
      image_count: 1,
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      estimated_cost: "0.1200"
    });
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });

  it("requires authentication", async () => {
    resetDevStore();
    resetImageTaskStore();

    const response = await getUsage(new Request("http://localhost/api/usage"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });
});
