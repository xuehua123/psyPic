import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/e2e/session/route";
import { resetDevStore } from "@/server/services/dev-store";

const originalToken = process.env.PSYPIC_E2E_TOKEN;

describe("E2E session helper", () => {
  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.PSYPIC_E2E_TOKEN;
    } else {
      process.env.PSYPIC_E2E_TOKEN = originalToken;
    }
    resetDevStore();
  });

  it("returns 404 when the E2E token is not configured", async () => {
    delete process.env.PSYPIC_E2E_TOKEN;

    const response = await POST(e2eSessionRequest({ role: "admin" }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("creates an admin session only with the matching E2E token", async () => {
    process.env.PSYPIC_E2E_TOKEN = "unit-e2e-token";

    const response = await POST(
      e2eSessionRequest(
        { role: "admin" },
        { "x-psypic-e2e-token": "unit-e2e-token" }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.session_bound).toBe(true);
    expect(body.data.role).toBe("admin");
    expect(response.headers.get("set-cookie")).toContain("psypic_session=");
  });
});

function e2eSessionRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>
) {
  return new Request("http://psypic.test/api/e2e/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}
