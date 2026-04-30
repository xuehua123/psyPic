import { describe, expect, it, vi } from "vitest";
import { generateImageWithSub2API } from "@/server/services/sub2api-client";

describe("Sub2API image client", () => {
  it("posts generation requests to the Images API without unsupported MVP fields", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
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
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await generateImageWithSub2API({
      baseUrl: "https://sub2api.example.com/v1",
      apiKey: "secret-token-value",
      params: {
        prompt: "Create a premium product photo.",
        model: "gpt-image-2",
        size: "1024x1024",
        quality: "medium",
        n: 1,
        output_format: "png",
        output_compression: null,
        background: "auto",
        moderation: "auto"
      }
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://sub2api.example.com/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer secret-token-value"
        })
      })
    );
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("input_fidelity");
    expect(body).not.toHaveProperty("stream");
    expect(body).not.toHaveProperty("output_compression");
    expect(response.upstreamRequestId).toBe("upstream_req_123");
    expect(response.images[0].b64_json).toBe(Buffer.from("image-bytes").toString("base64"));
  });

  it("normalizes upstream 429 into a rate limited error without leaking keys", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "quota exceeded for secret-token-value" }
          }),
          { status: 429, headers: { "content-type": "application/json" } }
        )
      )
    );

    await expect(
      generateImageWithSub2API({
        baseUrl: "https://sub2api.example.com/v1",
        apiKey: "secret-token-value",
        params: {
          prompt: "Create a premium product photo.",
          model: "gpt-image-2",
          size: "1024x1024",
          quality: "medium",
          n: 1,
          output_format: "png",
          output_compression: null,
          background: "auto",
          moderation: "auto"
        }
      })
    ).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
      message: expect.not.stringContaining("secret-token-value")
    });
  });
});
