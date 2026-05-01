import { describe, expect, it } from "vitest";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { resetDevStore } from "@/server/services/dev-store";

function importRequest(importCode: string) {
  return new Request("http://localhost/api/import/exchange", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ import_code: importCode })
  });
}

describe("POST /api/import/exchange", () => {
  it("binds a session without returning an API key", async () => {
    resetDevStore();

    const response = await exchangeImportCode(importRequest("valid_one_time_code"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("psypic_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
    expect(body.data.session_bound).toBe(true);
    expect(body.data.binding_id).toMatch(/^kb_/);
    expect(JSON.stringify(body)).not.toContain("api_key");
    expect(JSON.stringify(body)).not.toContain("Authorization");
  });

  it("rejects a repeated one-time import code", async () => {
    resetDevStore();

    await exchangeImportCode(importRequest("valid_one_time_code"));
    const response = await exchangeImportCode(importRequest("valid_one_time_code"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_import_code");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["expired_import_code", 400, "import_code_expired"],
    ["inactive_key_code", 403, "key_inactive"],
    ["quota_exhausted_code", 403, "key_quota_exhausted"],
    ["foreign_user_code", 403, "key_owner_mismatch"],
    ["non_openai_group_code", 403, "invalid_key_group"]
  ])(
    "rejects invalid Sub2API import state for %s",
    async (importCode, expectedStatus, expectedCode) => {
      resetDevStore();

      const response = await exchangeImportCode(importRequest(importCode));
      const body = await response.json();

      expect(response.status).toBe(expectedStatus);
      expect(body.error.code).toBe(expectedCode);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(JSON.stringify(body)).not.toContain("api_key");
      expect(JSON.stringify(body)).not.toContain("Authorization");
    }
  );
});
