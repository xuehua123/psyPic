import { describe, expect, it, vi } from "vitest";
import {
  editImageWithSub2API,
  generateImageWithSub2API
} from "@/server/services/sub2api-client";

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

  it("accepts a full Images API endpoint as the configured Base URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    await generateImageWithSub2API({
      baseUrl: "https://sub2api.example.com/v1/images/generations",
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
      expect.any(Object)
    );
  });

  it("does not silently follow Sub2API redirects that can drop authorization", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://sub2api.example.com/v1/images/generations" }
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      generateImageWithSub2API({
        baseUrl: "http://sub2api.example.com/v1",
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
      code: "upstream_redirect",
      status: 502,
      message: expect.stringContaining("Base URL 发生跳转")
    });
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
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

  it("explains upstream 401 as a Sub2API credential configuration problem without leaking keys", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 401,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const request = generateImageWithSub2API({
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

    await expect(request).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
      message: expect.stringContaining("Sub2API Key")
    });
    await expect(request).rejects.toMatchObject({
      message: expect.not.stringContaining("secret-token-value")
    });
  });

  it("posts image edit requests as multipart form data", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
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
    );
    vi.stubGlobal("fetch", fetchSpy);
    const image = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "product.png", {
      type: "image/png"
    });

    const response = await editImageWithSub2API({
      baseUrl: "https://sub2api.example.com/v1",
      apiKey: "secret-token-value",
      image,
      params: {
        prompt: "Replace the background with a premium studio scene.",
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
      "https://sub2api.example.com/v1/images/edits",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer secret-token-value"
        })
      })
    );
    const body = fetchSpy.mock.calls[0][1].body;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("image")).toBeInstanceOf(File);
    expect(body.get("prompt")).toBe("Replace the background with a premium studio scene.");
    expect(body.get("stream")).toBeNull();
    expect(body.get("input_fidelity")).toBeNull();
    expect(response.upstreamRequestId).toBe("upstream_edit_req_123");
    expect(response.images[0].b64_json).toBe(Buffer.from("edited-image").toString("base64"));
  });
});
