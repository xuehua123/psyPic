import { describe, expect, it } from "vitest";
import { POST as saveManualKey } from "@/app/api/settings/manual-key/route";
import { getKeyBindingForSession, resetDevStore } from "@/server/services/dev-store";

describe("POST /api/settings/manual-key", () => {
  it("stores manual development keys only through encrypted BFF key binding", async () => {
    resetDevStore();

    const response = await saveManualKey(
      new Request("http://localhost/api/settings/manual-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          base_url: "https://sub2api.example.com/v1",
          api_key: "secret-token-value",
          default_model: "gpt-image-2"
        })
      })
    );
    const body = await response.json();
    const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
    const binding = getKeyBindingForSession(cookie.replace("psypic_session=", ""));

    expect(response.status).toBe(200);
    expect(body.data.session_bound).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret-token-value");
    expect(binding?.sub2api_api_key_ciphertext).not.toContain("secret-token-value");
    expect(binding?.sub2api_base_url).toBe("https://sub2api.example.com/v1");
  });
});
