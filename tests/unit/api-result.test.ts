import { describe, expect, it, vi } from "vitest";
import { fetchApi } from "@/lib/client/api-result";

describe("fetchApi", () => {
  it("retains retry-after header on 503 Service Unavailable", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "service_unavailable", message: "Unavailable" }
        }),
        {
          status: 503,
          headers: {
            "content-type": "application/json",
            "retry-after": "120"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchApi("/api/test");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("service_unavailable");
      expect(result.retryAfter).toBe("120");
    }
  });

  it("handles successful response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { foo: "bar" },
          request_id: "req_123"
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchApi("/api/test");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ foo: "bar" });
      expect(result.requestId).toBe("req_123");
    }
  });
});
