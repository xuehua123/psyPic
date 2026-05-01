import { describe, expect, it, vi } from "vitest";
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

type RuntimeSettingRow = {
  key: string;
  value: unknown;
  updatedByUserId: string | null;
  updatedAt: Date;
};

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

  it("persists runtime settings to database store when enabled", async () => {
    resetDevStore();
    resetRuntimeSettingsStore();
    resetAuditLogStore();

    const previousStoreMode = process.env.PSYPIC_RUNTIME_SETTINGS_STORE;
    const rows = new Map<string, RuntimeSettingRow>();
    const prismaClient = {
      runtimeSetting: {
        upsert: async ({
          where,
          create,
          update
        }: {
          where: { key: string };
          create: RuntimeSettingRow;
          update: Omit<RuntimeSettingRow, "key">;
        }) => {
          const current = rows.get(where.key);
          const row = current
            ? {
                ...current,
                ...update
              }
            : {
                ...create,
                key: where.key
              };
          rows.set(where.key, row);

          return row;
        },
        findUnique: async ({ where }: { where: { key: string } }) =>
          rows.get(where.key) ?? null
      }
    };
    (
      globalThis as typeof globalThis & {
        __psypicRuntimeSettingsPrismaClient?: typeof prismaClient;
      }
    ).__psypicRuntimeSettingsPrismaClient = prismaClient;
    process.env.PSYPIC_RUNTIME_SETTINGS_STORE = "database";

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
            max_n: 5,
            max_upload_mb: 16,
            max_size_tier: "4K",
            allow_moderation_low: true,
            community_enabled: true,
            public_publish_enabled: false,
            stream_enabled: false
          })
        })
      );
      expect(updateResponse.status).toBe(200);
      expect(rows.get("global")?.value).toMatchObject({
        max_n: 5,
        max_size_tier: "4K",
        public_publish_enabled: false
      });

      resetRuntimeSettingsStore({ deletePersisted: false });

      const readResponse = await getRuntimeSettings(
        new Request("http://localhost/api/admin/runtime-settings", {
          headers: { cookie }
        })
      );
      const readBody = await readResponse.json();

      expect(readResponse.status).toBe(200);
      expect(readBody.data.source).toBe("database");
      expect(readBody.data.settings).toMatchObject({
        max_n: 5,
        max_upload_mb: 16,
        stream_enabled: false
      });
    } finally {
      resetRuntimeSettingsStore();
      delete (
        globalThis as typeof globalThis & {
          __psypicRuntimeSettingsPrismaClient?: unknown;
        }
      ).__psypicRuntimeSettingsPrismaClient;

      if (previousStoreMode) {
        process.env.PSYPIC_RUNTIME_SETTINGS_STORE = previousStoreMode;
      } else {
        delete process.env.PSYPIC_RUNTIME_SETTINGS_STORE;
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

  it("writes database audit logs without local file persistence in database mode", async () => {
    resetDevStore();
    const previousAuditStore = process.env.PSYPIC_AUDIT_LOG_STORE;
    const previousAuditPath = process.env.PSYPIC_AUDIT_LOG_FILE;
    const auditFileName = `psypic-audit-db-mode-${randomUUID()}.json`;
    const auditPath = join(process.cwd(), ".data", auditFileName);
    const create = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([]);
    const prismaClient = {
      auditLog: {
        create,
        findMany
      }
    };
    (
      globalThis as typeof globalThis & {
        __psypicAuditPrismaClient?: typeof prismaClient;
      }
    ).__psypicAuditPrismaClient = prismaClient;
    process.env.PSYPIC_AUDIT_LOG_STORE = "database";
    process.env.PSYPIC_AUDIT_LOG_FILE = auditFileName;
    resetAuditLogStore();

    try {
      const cookie = adminCookie();
      const response = await writeAuditLog(
        new Request("http://localhost/api/admin/audit-logs", {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({
            action: "image_generation.succeeded",
            target_type: "image_task",
            target_id: "task_db_audit",
            metadata: {
              upstream_request_id: "upstream_db_audit"
            }
          })
        })
      );

      expect(response.status).toBe(200);
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetId: "task_db_audit",
          metadata: expect.objectContaining({
            upstream_request_id: "upstream_db_audit"
          })
        })
      });
      expect(existsSync(auditPath)).toBe(false);
    } finally {
      resetAuditLogStore();
      if (existsSync(auditPath)) {
        rmSync(auditPath, { force: true });
      }
      delete (
        globalThis as typeof globalThis & {
          __psypicAuditPrismaClient?: unknown;
        }
      ).__psypicAuditPrismaClient;
      if (previousAuditStore) {
        process.env.PSYPIC_AUDIT_LOG_STORE = previousAuditStore;
      } else {
        delete process.env.PSYPIC_AUDIT_LOG_STORE;
      }
      if (previousAuditPath) {
        process.env.PSYPIC_AUDIT_LOG_FILE = previousAuditPath;
      } else {
        delete process.env.PSYPIC_AUDIT_LOG_FILE;
      }
    }
  });
});
