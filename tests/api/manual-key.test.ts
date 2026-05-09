import { beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as getSession } from "@/app/api/session/route";
import { POST as saveManualKey } from "@/app/api/settings/manual-key/route";
import { getKeyBindingForSession, resetDevStore } from "@/server/services/dev-store";
import { decryptKeyBindingSecret } from "@/server/services/key-binding-service";
import {
  clearAuthPrismaDouble,
  installAuthPrismaDouble
} from "./support/auth-prisma-double";

function authRequest(path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function extractCookie(response: Response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

describe("POST /api/settings/manual-key", () => {
  beforeEach(() => {
    resetDevStore();
    clearAuthPrismaDouble();
  });

  it("stores manual development keys only through encrypted BFF key binding", async () => {
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

  it("accepts a copied Authorization header value in the API Key field", async () => {
    const response = await saveManualKey(
      new Request("http://localhost/api/settings/manual-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          base_url: "https://sub2api.example.com/v1",
          api_key: "Authorization: Bearer secret-token-value",
          default_model: "gpt-image-2"
        })
      })
    );
    const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
    const binding = getKeyBindingForSession(cookie.replace("psypic_session=", ""));

    expect(response.status).toBe(200);
    expect(binding).toBeTruthy();
    expect(binding ? decryptKeyBindingSecret(binding) : "").toBe("secret-token-value");
    expect(JSON.stringify(binding)).not.toContain("secret-token-value");
  });

  it("binds a manual key to the current database session", async () => {
    const prismaClient = installAuthPrismaDouble();
    const registerResponse = await register(
      authRequest("/api/auth/register", {
        email: "manual-db@example.com",
        password: "correct horse battery staple",
        display_name: "Manual DB"
      })
    );
    const cookie = extractCookie(registerResponse);
    const sessionId = cookie.replace("psypic_session=", "");

    const response = await saveManualKey(
      new Request("http://localhost/api/settings/manual-key", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          base_url: "https://sub2api.example.com/v1",
          api_key: "secret-token-value",
          default_model: "gpt-image-2"
        })
      })
    );
    const body = await response.json();
    const sessionResponse = await getSession(
      authRequest("/api/session", undefined, cookie)
    );
    const sessionBody = await sessionResponse.json();
    const sessionRow = prismaClient.__getSession(sessionId);
    const bindingRow = sessionRow?.keyBindingId
      ? prismaClient.__getKeyBinding(sessionRow.keyBindingId)
      : null;

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")?.split(";")[0]).toBe(cookie);
    expect(body.data.session_bound).toBe(true);
    expect(sessionRow?.keyBindingId).toMatch(/^kb_/);
    expect(bindingRow?.sub2apiApiKeyCiphertext).not.toContain(
      "secret-token-value"
    );
    expect(sessionResponse.status).toBe(200);
    expect(sessionBody.data.authenticated).toBe(true);
    expect(sessionBody.data.binding).toMatchObject({
      id: sessionRow?.keyBindingId,
      base_url: "https://sub2api.example.com/v1",
      default_model: "gpt-image-2"
    });
    expect(JSON.stringify(sessionBody)).not.toContain("secret-token-value");
    expect(JSON.stringify(sessionBody)).not.toContain("ciphertext");
  });
});
