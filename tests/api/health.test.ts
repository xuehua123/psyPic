import { describe, expect, it } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { resetRuntimeSettingsStore } from "@/server/services/runtime-settings-service";

describe("Health API", () => {
  it("reports production readiness checks without leaking secrets", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousRedisUrl = process.env.REDIS_URL;
    const previousStorageDriver = process.env.ASSET_STORAGE_DRIVER;
    const previousRuntimeStore = process.env.PSYPIC_RUNTIME_SETTINGS_STORE;
    process.env.DATABASE_URL = "postgresql://user:secret@db.example.com/psypic";
    process.env.REDIS_URL = "redis://:secret@redis.example.com:6379";
    process.env.ASSET_STORAGE_DRIVER = "local";
    process.env.PSYPIC_RUNTIME_SETTINGS_STORE = "file";
    resetRuntimeSettingsStore();

    try {
      const response = await health(new Request("http://localhost/api/health"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.ok).toBe(true);
      expect(body.data.checks.db).toMatchObject({ status: "configured" });
      expect(body.data.checks.redis).toMatchObject({ status: "configured" });
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
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
