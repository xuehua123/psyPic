import { describe, expect, it } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { resetRuntimeSettingsStore } from "@/server/services/runtime-settings-service";

describe("Health API", () => {
  it("reports production readiness checks without leaking secrets", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousRedisUrl = process.env.REDIS_URL;
    const previousStorageDriver = process.env.ASSET_STORAGE_DRIVER;
    const previousRuntimeStore = process.env.PSYPIC_RUNTIME_SETTINGS_STORE;
    const previousAuthStore = process.env.PSYPIC_AUTH_STORE;
    const previousWorkbenchStore = process.env.PSYPIC_WORKBENCH_PROJECTS_STORE;
    const previousSessionSecret = process.env.SESSION_SECRET;
    const previousKeyEncryptionSecret = process.env.KEY_ENCRYPTION_SECRET;
    process.env.DATABASE_URL = "postgresql://user:secret@db.example.com/psypic";
    process.env.REDIS_URL = "redis://:secret@redis.example.com:6379";
    process.env.ASSET_STORAGE_DRIVER = "local";
    process.env.PSYPIC_RUNTIME_SETTINGS_STORE = "file";
    process.env.PSYPIC_AUTH_STORE = "database";
    process.env.PSYPIC_WORKBENCH_PROJECTS_STORE = "database";
    process.env.SESSION_SECRET = "unit-session-secret-with-production-entropy";
    process.env.KEY_ENCRYPTION_SECRET =
      "unit-key-encryption-secret-with-production-entropy";
    resetRuntimeSettingsStore();

    try {
      const response = await health(new Request("http://localhost/api/health"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.ok).toBe(true);
      expect(body.data.checks.db).toMatchObject({ status: "configured" });
      expect(body.data.checks.redis).toMatchObject({ status: "configured" });
      expect(body.data.checks.credentials).toMatchObject({
        status: "configured",
        session_signing: "configured",
        key_encryption: "configured",
        distinct_keys: "configured"
      });
      expect(body.data.checks.auth_session).toMatchObject({
        status: "configured",
        store: "database"
      });
      expect(body.data.checks.workbench).toMatchObject({
        status: "configured",
        store: "database"
      });
      expect(body.data.checks.temp_asset.status).toBe("pass");
      expect(body.data.checks.storage).toMatchObject({
        status: "pass",
        driver: "local"
      });
      expect(body.data.checks.runtime_settings.source).toBe("environment");
      expect(JSON.stringify(body)).not.toContain("secret");
      expect(JSON.stringify(body)).not.toContain("postgresql://");
      expect(JSON.stringify(body)).not.toContain("redis://");
    } finally {
      resetRuntimeSettingsStore();

      restoreEnv("DATABASE_URL", previousDatabaseUrl);
      restoreEnv("REDIS_URL", previousRedisUrl);
      restoreEnv("ASSET_STORAGE_DRIVER", previousStorageDriver);
      restoreEnv("PSYPIC_RUNTIME_SETTINGS_STORE", previousRuntimeStore);
      restoreEnv("PSYPIC_AUTH_STORE", previousAuthStore);
      restoreEnv("PSYPIC_WORKBENCH_PROJECTS_STORE", previousWorkbenchStore);
      restoreEnv("SESSION_SECRET", previousSessionSecret);
      restoreEnv("KEY_ENCRYPTION_SECRET", previousKeyEncryptionSecret);
    }
  });

  it("reports fallback store modes for local diagnostics", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousAuthStore = process.env.PSYPIC_AUTH_STORE;
    const previousWorkbenchStore = process.env.PSYPIC_WORKBENCH_PROJECTS_STORE;
    const previousRuntimeStore = process.env.PSYPIC_RUNTIME_SETTINGS_STORE;
    delete process.env.DATABASE_URL;
    process.env.PSYPIC_AUTH_STORE = "memory";
    process.env.PSYPIC_WORKBENCH_PROJECTS_STORE = "indexeddb";
    process.env.PSYPIC_RUNTIME_SETTINGS_STORE = "file";
    resetRuntimeSettingsStore();

    try {
      const response = await health(new Request("http://localhost/api/health"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.checks.auth_session).toMatchObject({
        status: "skipped",
        store: "memory"
      });
      expect(body.data.checks.workbench).toMatchObject({
        status: "skipped",
        store: "indexeddb",
        api_mode: "fallback_503"
      });
    } finally {
      resetRuntimeSettingsStore();

      restoreEnv("DATABASE_URL", previousDatabaseUrl);
      restoreEnv("PSYPIC_AUTH_STORE", previousAuthStore);
      restoreEnv("PSYPIC_WORKBENCH_PROJECTS_STORE", previousWorkbenchStore);
      restoreEnv("PSYPIC_RUNTIME_SETTINGS_STORE", previousRuntimeStore);
    }
  });

  it("fails object storage readiness when non-local credentials are incomplete", async () => {
    const previousDriver = process.env.ASSET_STORAGE_DRIVER;
    const previousBucket = process.env.ASSET_STORAGE_BUCKET;
    const previousAccessKey = process.env.ASSET_STORAGE_ACCESS_KEY_ID;
    const previousSecretKey = process.env.ASSET_STORAGE_SECRET_ACCESS_KEY;
    process.env.ASSET_STORAGE_DRIVER = "r2";
    process.env.ASSET_STORAGE_BUCKET = "psypic-assets";
    delete process.env.ASSET_STORAGE_ACCESS_KEY_ID;
    delete process.env.ASSET_STORAGE_SECRET_ACCESS_KEY;

    try {
      const response = await health(new Request("http://localhost/api/health"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.ok).toBe(false);
      expect(body.data.checks.storage).toMatchObject({
        status: "fail",
        driver: "r2",
        missing: ["access_key", "secret_key", "endpoint"]
      });
    } finally {
      restoreEnv("ASSET_STORAGE_DRIVER", previousDriver);
      restoreEnv("ASSET_STORAGE_BUCKET", previousBucket);
      restoreEnv("ASSET_STORAGE_ACCESS_KEY_ID", previousAccessKey);
      restoreEnv("ASSET_STORAGE_SECRET_ACCESS_KEY", previousSecretKey);
    }
  });

  it("fails production readiness for placeholder secrets and local storage", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSessionSecret = process.env.SESSION_SECRET;
    const previousKeyEncryptionSecret = process.env.KEY_ENCRYPTION_SECRET;
    const previousStorageDriver = process.env.ASSET_STORAGE_DRIVER;
    const previousAllowLocalStorage =
      process.env.PSYPIC_ALLOW_LOCAL_ASSET_STORAGE;
    setEnv("NODE_ENV", "production");
    process.env.SESSION_SECRET = "replace-with-session-secret";
    process.env.KEY_ENCRYPTION_SECRET =
      "replace-with-different-key-encryption-secret";
    process.env.ASSET_STORAGE_DRIVER = "local";
    delete process.env.PSYPIC_ALLOW_LOCAL_ASSET_STORAGE;

    try {
      const response = await health(new Request("http://localhost/api/health"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.ok).toBe(false);
      expect(body.data.checks.credentials).toMatchObject({
        status: "fail",
        session_signing: "placeholder",
        key_encryption: "placeholder"
      });
      expect(body.data.checks.credentials.issues).toEqual(
        expect.arrayContaining(["session_signing", "key_encryption"])
      );
      expect(body.data.checks.storage).toMatchObject({
        status: "fail",
        driver: "local",
        missing: ["s3_compatible_storage_driver"]
      });
    } finally {
      restoreEnv("NODE_ENV", previousNodeEnv);
      restoreEnv("SESSION_SECRET", previousSessionSecret);
      restoreEnv("KEY_ENCRYPTION_SECRET", previousKeyEncryptionSecret);
      restoreEnv("ASSET_STORAGE_DRIVER", previousStorageDriver);
      restoreEnv("PSYPIC_ALLOW_LOCAL_ASSET_STORAGE", previousAllowLocalStorage);
    }
  });

  it("allows local storage for temporary direct-IP production staging", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSessionSecret = process.env.SESSION_SECRET;
    const previousKeyEncryptionSecret = process.env.KEY_ENCRYPTION_SECRET;
    const previousStorageDriver = process.env.ASSET_STORAGE_DRIVER;
    const previousAllowLocalStorage =
      process.env.PSYPIC_ALLOW_LOCAL_ASSET_STORAGE;
    setEnv("NODE_ENV", "production");
    process.env.SESSION_SECRET = "unit-session-secret-with-production-entropy";
    process.env.KEY_ENCRYPTION_SECRET =
      "unit-key-encryption-secret-with-production-entropy";
    process.env.ASSET_STORAGE_DRIVER = "local";
    process.env.PSYPIC_ALLOW_LOCAL_ASSET_STORAGE = "true";

    try {
      const response = await health(new Request("http://localhost/api/health"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.checks.storage).toMatchObject({
        status: "configured",
        driver: "local",
        mode: "temporary_direct_ip"
      });
    } finally {
      restoreEnv("NODE_ENV", previousNodeEnv);
      restoreEnv("SESSION_SECRET", previousSessionSecret);
      restoreEnv("KEY_ENCRYPTION_SECRET", previousKeyEncryptionSecret);
      restoreEnv("ASSET_STORAGE_DRIVER", previousStorageDriver);
      restoreEnv("PSYPIC_ALLOW_LOCAL_ASSET_STORAGE", previousAllowLocalStorage);
    }
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function setEnv(name: string, value: string) {
  process.env[name] = value;
}
