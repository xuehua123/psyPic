import { describe, expect, it } from "vitest";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { GET as getSession } from "@/app/api/session/route";
import { POST as logoutSession } from "@/app/api/session/logout/route";
import { resetDevStore } from "@/server/services/dev-store";

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

describe("session API", () => {
  it("returns authenticated session metadata without API keys", async () => {
    resetDevStore();
    const cookie = await bindSession();

    const response = await getSession(
      new Request("http://localhost/api/session", {
        headers: { cookie }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.authenticated).toBe(true);
    expect(body.data.binding.id).toMatch(/^kb_/);
    expect(body.data.binding.base_url).toBe("https://sub2api.example.com/v1");
    expect(body.data.binding.default_model).toBe("gpt-image-2");
    expect(body.data.limits.max_n).toBe(4);
    expect(body.data.features.stream).toBe(false);
    expect(JSON.stringify(body)).not.toContain("api_key");
    expect(JSON.stringify(body)).not.toContain("ciphertext");
  });

  it("returns an anonymous session shape when no cookie is present", async () => {
    resetDevStore();

    const response = await getSession(
      new Request("http://localhost/api/session")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.authenticated).toBe(false);
    expect(body.data.features.community).toBe(false);
  });

  it("expires the session cookie on logout", async () => {
    resetDevStore();
    const cookie = await bindSession();

    const response = await logoutSession(
      new Request("http://localhost/api/session/logout", {
        method: "POST",
        headers: { cookie }
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("psypic_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
