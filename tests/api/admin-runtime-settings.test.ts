import { describe, expect, it } from "vitest";
import {
  GET as listAuditLogs,
  POST as writeAuditLog
} from "@/app/api/admin/audit-logs/route";
import {
  GET as getRuntimeSettings,
  PATCH as updateRuntimeSettings
} from "@/app/api/admin/runtime-settings/route";
import {
  createAdminSessionForDev,
  resetDevStore
} from "@/server/services/dev-store";
import { resetAuditLogStore } from "@/server/services/audit-log-service";
import { resetRuntimeSettingsStore } from "@/server/services/runtime-settings-service";

function adminCookie() {
  const admin = createAdminSessionForDev();

  return `psypic_session=${admin.session.id}`;
}

describe("Admin runtime settings API", () => {
  it("requires admin role to read runtime settings", async () => {
    resetDevStore();
    resetRuntimeSettingsStore();

    const response = await getRuntimeSettings(
      new Request("http://localhost/api/admin/runtime-settings")
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });

  it("persists admin runtime settings overrides", async () => {
    resetDevStore();
    resetRuntimeSettingsStore();
    resetAuditLogStore();
    const cookie = adminCookie();

    const updateResponse = await updateRuntimeSettings(
      new Request("http://localhost/api/admin/runtime-settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          max_n: 2,
          max_upload_mb: 8,
          max_size_tier: "2K",
          allow_moderation_low: false,
          community_enabled: true,
          public_publish_enabled: false,
          stream_enabled: true
        })
      })
    );
    const updateBody = await updateResponse.json();

    const readResponse = await getRuntimeSettings(
      new Request("http://localhost/api/admin/runtime-settings", {
        headers: { cookie }
      })
    );
    const readBody = await readResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody.data.settings).toMatchObject({
      max_n: 2,
      max_upload_mb: 8,
      max_size_tier: "2K",
      public_publish_enabled: false
    });
    expect(readResponse.status).toBe(200);
    expect(readBody.data.settings.public_publish_enabled).toBe(false);
    expect(readBody.data.source).toBe("persisted");
    expect(JSON.stringify(readBody)).not.toContain("secret-token");
  });

  it("records and lists redacted audit logs for admin actions", async () => {
    resetDevStore();
    resetAuditLogStore();
    const cookie = adminCookie();

    await writeAuditLog(
      new Request("http://localhost/api/admin/audit-logs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          action: "test.sensitive",
          target_type: "test",
          target_id: "target_123",
          metadata: {
            Authorization: "Bearer secret-token-audit",
            nested: {
              api_key: "secret-token-audit"
            },
            upstream_request_id: "upstream_req_123"
          }
        })
      })
    );

    const response = await listAuditLogs(
      new Request("http://localhost/api/admin/audit-logs", {
        headers: { cookie }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items[0]).toMatchObject({
      action: "test.sensitive",
      target_type: "test",
      target_id: "target_123"
    });
    expect(body.data.items[0].metadata.upstream_request_id).toBe(
      "upstream_req_123"
    );
    expect(JSON.stringify(body)).not.toContain("secret-token-audit");
    expect(JSON.stringify(body)).toContain("[REDACTED]");
  });
});
