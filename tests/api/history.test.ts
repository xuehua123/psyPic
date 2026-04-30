import { describe, expect, it, vi } from "vitest";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { POST as generateImage } from "@/app/api/images/generations/route";
import { GET as listHistory } from "@/app/api/history/route";
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

describe("GET /api/history", () => {
  it("lists the current user's completed image tasks as server history", async () => {
    resetDevStore();
    resetImageTaskStore();
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
              "x-request-id": "upstream_history_req_123"
            }
          }
        )
      )
    );

    const generationResponse = await generateImage(
      generationRequest(cookie, "Create a premium product photo.")
    );
    const generationBody = await generationResponse.json();

    const response = await listHistory(
      new Request("http://localhost/api/history?limit=10", {
        headers: { cookie }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      task_id: generationBody.data.task_id,
      prompt: "Create a premium product photo.",
      thumbnail_url: expect.stringMatching(/^\/api\/assets\/asset_/),
      type: "generation",
      upstream_request_id: "upstream_history_req_123"
    });
    expect(body.data.next_cursor).toBeNull();
    expect(JSON.stringify(body)).not.toContain("secret-token");
    expect(JSON.stringify(body)).not.toContain("api_key");
  });

  it("requires an authenticated session", async () => {
    resetDevStore();
    resetImageTaskStore();

    const response = await listHistory(new Request("http://localhost/api/history"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });

  it("uses the last item in a page as the next cursor", async () => {
    resetDevStore();
    resetImageTaskStore();
    await resetTempAssetStore();
    const cookie = await bindSession();
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
              headers: { "content-type": "application/json" }
            }
          )
        )
      )
    );

    await generateImage(generationRequest(cookie, "Old product photo."));
    await new Promise((resolve) => setTimeout(resolve, 1));
    await generateImage(generationRequest(cookie, "Middle product photo."));
    await new Promise((resolve) => setTimeout(resolve, 1));
    await generateImage(generationRequest(cookie, "Newest product photo."));

    const firstResponse = await listHistory(
      new Request("http://localhost/api/history?limit=2", {
        headers: { cookie }
      })
    );
    const firstBody = await firstResponse.json();
    const secondResponse = await listHistory(
      new Request(
        `http://localhost/api/history?limit=2&cursor=${firstBody.data.next_cursor}`,
        {
          headers: { cookie }
        }
      )
    );
    const secondBody = await secondResponse.json();

    expect(firstBody.data.items.map((item: { prompt: string }) => item.prompt)).toEqual([
      "Newest product photo.",
      "Middle product photo."
    ]);
    expect(firstBody.data.next_cursor).toBe(firstBody.data.items[1].task_id);
    expect(secondBody.data.items.map((item: { prompt: string }) => item.prompt)).toEqual([
      "Old product photo."
    ]);
    expect(secondBody.data.next_cursor).toBeNull();
  });
});
