import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import { getRuntimeSettingsSnapshot } from "@/server/services/runtime-settings-service";

type HealthStatus = "pass" | "configured" | "skipped" | "fail";

export async function GET(_request: Request) {
  const requestId = createRequestId();
  const runtimeSettings = await getRuntimeSettingsSnapshot();
  const checks = {
    db: checkConfigured("DATABASE_URL"),
    redis: checkConfigured("REDIS_URL"),
    auth_session: checkAuthSessionStore(),
    workbench: checkWorkbenchStore(),
    temp_asset: await checkTempAssetStorage(),
    storage: checkAssetStorage(),
    runtime_settings: {
      status: "pass" as const,
      source: runtimeSettings.source
    }
  };
  const ok = Object.values(checks).every((check) => check.status !== "fail");

  return jsonOk({ ok, checks }, requestId);
}

function checkConfigured(envName: string) {
  return {
    status: process.env[envName]?.trim() ? ("configured" as const) : ("skipped" as const)
  };
}

function checkAuthSessionStore() {
  const configuredMode = process.env.PSYPIC_AUTH_STORE?.trim().toLowerCase();
  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const store =
    configuredMode === "database" || configuredMode === "db"
      ? "database"
      : configuredMode === "memory" || configuredMode === "dev"
        ? "memory"
        : process.env.NODE_ENV === "production" && databaseConfigured
          ? "database"
          : "memory";

  if (store === "database") {
    return {
      status: databaseConfigured ? ("configured" as const) : ("fail" as const),
      store,
      database_url: databaseConfigured ? "configured" : "missing"
    };
  }

  return {
    status: "skipped" as const,
    store
  };
}

function checkWorkbenchStore() {
  const configuredMode =
    process.env.PSYPIC_WORKBENCH_PROJECTS_STORE?.trim().toLowerCase();
  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const store =
    configuredMode === "database" || configuredMode === "db"
      ? "database"
      : configuredMode === "file" ||
          configuredMode === "memory" ||
          configuredMode === "indexeddb" ||
          configuredMode === "local"
        ? configuredMode
        : databaseConfigured
          ? "database"
          : "indexeddb";

  if (store === "database") {
    return {
      status: databaseConfigured ? ("configured" as const) : ("fail" as const),
      store,
      database_url: databaseConfigured ? "configured" : "missing"
    };
  }

  return {
    status: "skipped" as const,
    store,
    api_mode: "fallback_503"
  };
}

async function checkTempAssetStorage() {
  try {
    await mkdir(/* turbopackIgnore: true */ getTempAssetRoot(), {
      recursive: true
    });

    return { status: "pass" as const };
  } catch {
    return { status: "fail" as const };
  }
}

function checkAssetStorage(): {
  status: HealthStatus;
  driver: string;
  missing?: string[];
} {
  const driver = process.env.ASSET_STORAGE_DRIVER?.trim() || "local";

  if (driver === "local") {
    return { status: "pass", driver };
  }

  const required: Array<[string, string | undefined]> = [
    ["bucket", process.env.ASSET_STORAGE_BUCKET],
    [
      "access_key",
      process.env.ASSET_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
    ],
    [
      "secret_key",
      process.env.ASSET_STORAGE_SECRET_ACCESS_KEY ||
        process.env.AWS_SECRET_ACCESS_KEY
    ]
  ];
  const missing = required
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);

  if (driver === "r2" || driver === "minio") {
    const endpoint = process.env.ASSET_STORAGE_ENDPOINT;

    if (!endpoint?.trim()) {
      missing.push("endpoint");
    }
  }

  return missing.length > 0
    ? { status: "fail", driver, missing }
    : { status: "configured", driver };
}

function getTempAssetRoot() {
  return path.join(process.cwd(), "output", "temp-assets");
}
