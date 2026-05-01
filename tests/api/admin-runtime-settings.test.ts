import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
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
    resetAuditLogStore();
    const previousStorePath = process.env.PSYPIC_RUNTIME_SETTINGS_FILE;
    const storeFileName = `psypic-runtime-settings-${randomUUID()}.json`;
    const storePath = join(process.cwd(), ".data", storeFileName);
    process.env.PSYPIC_RUNTIME_SETTINGS_FILE = storeFileName;

    try {
      resetRuntimeSettingsStore();
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
    } finally {
      resetRuntimeSettingsStore();
      if (existsSync(storePath)) {
        rmSync(storePath, { force: true });
      }

      if (previousStorePath) {
        process.env.PSYPIC_RUNTIME_SETTINGS_FILE = previousStorePath;
      } else {
        delete process.env.PSYPIC_RUNTIME_SETTINGS_FILE;
      }
    }
  });

  it("reloads persisted runtime settings after in-memory state is cleared", async () => {
    resetDevStore();
    resetRuntimeSettingsStore();
    resetAuditLogStore();

    const previousStorePath = process.env.PSYPIC_RUNTIME_SETTINGS_FILE;
    const storeFileName = `psypic-runtime-settings-${randomUUID()}.json`;
    const storePath = join(process.cwd(), ".data", storeFileName);
    process.env.PSYPIC_RUNTIME_SETTINGS_FILE = storeFileName;

    try {
      const cookie = adminCookie();

      const updateResponse = await updateRuntimeSettings(
        new Request("http://localhost/api/admin/runtime-settings", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie
          },
          body: JSON.stringify({
            max_n: 3,
            max_upload_mb: 12,
            max_size_tier: "4K",
            allow_moderation_low: true,
            community_enabled: true,
            public_publish_enabled: true,
            stream_enabled: false
          })
        })
      );
      expect(updateResponse.status).toBe(200);

      delete (
        globalThis as typeof globalThis & {
          __psypicRuntimeSettingsRecord?: unknown;
        }
      ).__psypicRuntimeSettingsRecord;

      const readResponse = await getRuntimeSettings(
        new Request("http://localhost/api/admin/runtime-settings", {
          headers: { cookie }
        })
      );
      const readBody = await readResponse.json();

      expect(readResponse.status).toBe(200);
      expect(readBody.data.source).toBe("persisted");
      expect(readBody.data.settings).toMatchObject({
        max_n: 3,
        max_size_tier: "4K",
        stream_enabled: false
      });
    } finally {
      resetRuntimeSettingsStore();
      if (existsSync(storePath)) {
        rmSync(storePath, { force: true });
      }

      if (previousStorePath) {
        process.env.PSYPIC_RUNTIME_SETTINGS_FILE = previousStorePath;
      } else {
        delete process.env.PSYPIC_RUNTIME_SETTINGS_FILE;
      }
    }
  });

  it("records and lists redacted audit logs for admin actions", async () => {
    resetDevStore();
    const previousAuditPath = process.env.PSYPIC_AUDIT_LOG_FILE;
    const auditFileName = `psypic-audit-${randomUUID()}.json`;
    const auditPath = join(process.cwd(), ".data", auditFileName);
    process.env.PSYPIC_AUDIT_LOG_FILE = auditFileName;

    try {
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
    } finally {
      resetAuditLogStore();
      if (existsSync(auditPath)) {
        rmSync(auditPath, { force: true });
      }

      if (previousAuditPath) {
        process.env.PSYPIC_AUDIT_LOG_FILE = previousAuditPath;
      } else {
        delete process.env.PSYPIC_AUDIT_LOG_FILE;
      }
    }
  });

  it("reloads persisted audit logs after in-memory state is cleared", async () => {
    resetDevStore();

    const previousAuditPath = process.env.PSYPIC_AUDIT_LOG_FILE;
    const auditFileName = `psypic-audit-${randomUUID()}.json`;
    const auditPath = join(process.cwd(), ".data", auditFileName);
    process.env.PSYPIC_AUDIT_LOG_FILE = auditFileName;

    try {
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
            action: "community.work.feature",
            target_type: "community_work",
            target_id: "work_persisted_audit",
            metadata: {
              upstream_request_id: "upstream_persisted_audit"
            }
          })
        })
      );

      resetAuditLogStore({ deletePersisted: false });

      const response = await listAuditLogs(
        new Request("http://localhost/api/admin/audit-logs", {
          headers: { cookie }
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.items[0]).toMatchObject({
        action: "community.work.feature",
        target_id: "work_persisted_audit"
      });
    } finally {
      resetAuditLogStore();
      if (existsSync(auditPath)) {
        rmSync(auditPath, { force: true });
      }

      if (previousAuditPath) {
        process.env.PSYPIC_AUDIT_LOG_FILE = previousAuditPath;
      } else {
        delete process.env.PSYPIC_AUDIT_LOG_FILE;
      }
    }
  });
});
