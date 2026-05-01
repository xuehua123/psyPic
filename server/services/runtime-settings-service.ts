import { basename, dirname, join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import type { KeyBindingLimits } from "@/server/services/key-binding-service";

type RuntimeMaxSizeTier = "2K" | "4K";

export type RuntimeSettings = {
  max_n: number;
  max_upload_mb: number;
  max_size_tier: RuntimeMaxSizeTier;
  allow_moderation_low: boolean;
  community_enabled: boolean;
  public_publish_enabled: boolean;
  stream_enabled: boolean;
};

type RuntimeSettingsRecord = {
  settings: RuntimeSettings;
  updated_by_user_id: string | null;
  updated_at: string;
  source?: "database" | "persisted";
};

type PrismaRuntimeSettingRecord = {
  key: string;
  value: unknown;
  updatedByUserId: string | null;
  updatedAt: Date;
};

type PrismaRuntimeSettingsClient = {
  runtimeSetting: {
    findUnique(input: {
      where: { key: string };
    }): Promise<PrismaRuntimeSettingRecord | null>;
    upsert(input: {
      where: { key: string };
      create: {
        key: string;
        value: unknown;
        updatedByUserId: string | null;
        updatedAt: Date;
      };
      update: {
        value: unknown;
        updatedByUserId: string | null;
        updatedAt: Date;
      };
    }): Promise<PrismaRuntimeSettingRecord>;
  };
};

declare global {
  var __psypicRuntimeSettingsRecord: RuntimeSettingsRecord | undefined;
  var __psypicRuntimeSettingsPrismaClient:
    | PrismaRuntimeSettingsClient
    | null
    | undefined;
}

const defaultRuntimeSettings: RuntimeSettings = {
  max_n: 4,
  max_upload_mb: 20,
  max_size_tier: "2K",
  allow_moderation_low: false,
  community_enabled: true,
  public_publish_enabled: true,
  stream_enabled: true
};

const runtimeSettingsKey = "global";

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  return (await getRuntimeSettingsRecord())?.settings ?? readEnvSettings();
}

export async function getRuntimeSettingsSnapshot() {
  const record = await getRuntimeSettingsRecord();

  return {
    settings: (await getRuntimeSettingsRecord())?.settings ?? readEnvSettings(),
    source: record?.source ?? (record ? "persisted" : ("environment" as const)),
    updated_by_user_id: record?.updated_by_user_id ?? null,
    updated_at: record?.updated_at ?? null
  };
}

export async function updateRuntimeSettings(
  patch: RuntimeSettings,
  input: { updatedByUserId: string }
) {
  const now = new Date().toISOString();
  const record: RuntimeSettingsRecord = {
    settings: patch,
    updated_by_user_id: input.updatedByUserId,
    updated_at: now
  };
  globalThis.__psypicRuntimeSettingsRecord = record;
  writePersistedRuntimeSettings(record);
  const databaseRecord = await writeDatabaseRuntimeSettings(record);

  if (databaseRecord) {
    globalThis.__psypicRuntimeSettingsRecord = databaseRecord;
  }

  return getRuntimeSettingsSnapshot();
}

export function resetRuntimeSettingsStore(options?: { deletePersisted?: boolean }) {
  globalThis.__psypicRuntimeSettingsRecord = undefined;

  if (options?.deletePersisted === false) {
    return;
  }

  const storePath = getRuntimeSettingsStorePath();
  if (existsSync(storePath)) {
    rmSync(storePath, { force: true });
  }
}

function readEnvSettings(): RuntimeSettings {
  return {
    max_n: readPositiveIntEnv("PSYPIC_MAX_IMAGE_N", defaultRuntimeSettings.max_n),
    max_upload_mb: readPositiveIntEnv(
      "PSYPIC_MAX_UPLOAD_MB",
      readPositiveIntEnv("MAX_IMAGE_UPLOAD_MB", defaultRuntimeSettings.max_upload_mb)
    ),
    max_size_tier: readSizeTierEnv(
      "PSYPIC_MAX_SIZE_TIER",
      defaultRuntimeSettings.max_size_tier
    ),
    allow_moderation_low: readBooleanEnv(
      "PSYPIC_ALLOW_MODERATION_LOW",
      defaultRuntimeSettings.allow_moderation_low
    ),
    community_enabled: readBooleanEnv(
      "PSYPIC_COMMUNITY_ENABLED",
      defaultRuntimeSettings.community_enabled
    ),
    public_publish_enabled: readBooleanEnv(
      "PSYPIC_PUBLIC_PUBLISH_ENABLED",
      defaultRuntimeSettings.public_publish_enabled
    ),
    stream_enabled: readBooleanEnv(
      "PSYPIC_STREAM_ENABLED",
      defaultRuntimeSettings.stream_enabled
    )
  };
}

export async function getEffectiveImageLimits(bindingLimits?: KeyBindingLimits) {
  const settings = await getRuntimeSettings();

  if (!bindingLimits) {
    return {
      max_n: settings.max_n,
      max_upload_mb: settings.max_upload_mb,
      max_size_tier: settings.max_size_tier,
      allow_moderation_low: settings.allow_moderation_low
    };
  }

  return {
    max_n: Math.min(bindingLimits.max_n, settings.max_n),
    max_upload_mb: Math.min(bindingLimits.max_upload_mb, settings.max_upload_mb),
    max_size_tier:
      settings.max_size_tier === "2K" ? "2K" : bindingLimits.max_size_tier,
    allow_moderation_low:
      bindingLimits.allow_moderation_low && settings.allow_moderation_low
  };
}

export async function getRuntimeFeatureFlags() {
  const settings = await getRuntimeSettings();

  return {
    community: settings.community_enabled,
    public_publish:
      settings.community_enabled && settings.public_publish_enabled,
    stream: settings.stream_enabled
  };
}

function readPositiveIntEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  return fallback;
}

function readSizeTierEnv(name: string, fallback: RuntimeMaxSizeTier) {
  const value = process.env[name];

  if (value === "2K" || value === "4K") {
    return value;
  }

  return fallback;
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return fallback;
}

async function getRuntimeSettingsRecord() {
  if (globalThis.__psypicRuntimeSettingsRecord) {
    return globalThis.__psypicRuntimeSettingsRecord;
  }

  const record =
    (await readDatabaseRuntimeSettings()) ?? readPersistedRuntimeSettings();
  if (record) {
    globalThis.__psypicRuntimeSettingsRecord = record;
  }

  return record;
}

async function readDatabaseRuntimeSettings() {
  const client = await getPrismaRuntimeSettingsClient();

  if (!client) {
    return undefined;
  }

  try {
    const row = await client.runtimeSetting.findUnique({
      where: { key: runtimeSettingsKey }
    });

    return row ? fromPrismaRuntimeSettingRecord(row) : undefined;
  } catch {
    return undefined;
  }
}

async function writeDatabaseRuntimeSettings(record: RuntimeSettingsRecord) {
  const client = await getPrismaRuntimeSettingsClient();

  if (!client) {
    return null;
  }

  try {
    const updatedAt = new Date(record.updated_at);
    const row = await client.runtimeSetting.upsert({
      where: { key: runtimeSettingsKey },
      create: {
        key: runtimeSettingsKey,
        value: record.settings,
        updatedByUserId: record.updated_by_user_id,
        updatedAt
      },
      update: {
        value: record.settings,
        updatedByUserId: record.updated_by_user_id,
        updatedAt
      }
    });

    return fromPrismaRuntimeSettingRecord(row);
  } catch {
    return null;
  }
}

function readPersistedRuntimeSettings() {
  const storePath = getRuntimeSettingsStorePath();

  if (!existsSync(storePath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as unknown;
    return parsePersistedRuntimeSettingsRecord(parsed) ?? undefined;
  } catch {
    return undefined;
  }
}

function writePersistedRuntimeSettings(record: RuntimeSettingsRecord) {
  const storePath = getRuntimeSettingsStorePath();
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(`${storePath}.tmp`, JSON.stringify(record, null, 2), "utf8");
  renameSync(`${storePath}.tmp`, storePath);
}

function getRuntimeSettingsStorePath() {
  const fileName = basename(
    process.env.PSYPIC_RUNTIME_SETTINGS_FILE?.trim() || "runtime-settings.json"
  );

  return join(/* turbopackIgnore: true */ process.cwd(), ".data", fileName);
}

async function getPrismaRuntimeSettingsClient() {
  if (!shouldUseDatabaseRuntimeSettings()) {
    return null;
  }

  if (globalThis.__psypicRuntimeSettingsPrismaClient !== undefined) {
    return globalThis.__psypicRuntimeSettingsPrismaClient;
  }

  try {
    const prismaClientPackage = "@prisma/client";
    const prismaModule = (await import(
      /* turbopackIgnore: true */ prismaClientPackage
    )) as {
      PrismaClient?: new () => PrismaRuntimeSettingsClient;
    };

    globalThis.__psypicRuntimeSettingsPrismaClient = prismaModule.PrismaClient
      ? new prismaModule.PrismaClient()
      : null;
  } catch {
    globalThis.__psypicRuntimeSettingsPrismaClient = null;
  }

  return globalThis.__psypicRuntimeSettingsPrismaClient;
}

function shouldUseDatabaseRuntimeSettings() {
  const mode = process.env.PSYPIC_RUNTIME_SETTINGS_STORE?.trim().toLowerCase();

  if (mode === "file") {
    return false;
  }

  return (
    mode === "database" ||
    mode === "db" ||
    (process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL))
  );
}

function fromPrismaRuntimeSettingRecord(
  row: PrismaRuntimeSettingRecord
): RuntimeSettingsRecord | undefined {
  if (!isRuntimeSettings(row.value)) {
    return undefined;
  }

  return {
    settings: row.value,
    updated_by_user_id: row.updatedByUserId,
    updated_at: row.updatedAt.toISOString(),
    source: "database"
  };
}

function parsePersistedRuntimeSettingsRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.updated_by_user_id !== "string" ||
    typeof record.updated_at !== "string" ||
    !isRuntimeSettings(record.settings)
  ) {
    return null;
  }

  return {
    settings: record.settings,
    updated_by_user_id: record.updated_by_user_id,
    updated_at: record.updated_at,
    source: "persisted"
  } satisfies RuntimeSettingsRecord;
}

function isRuntimeSettings(value: unknown): value is RuntimeSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const settings = value as Record<string, unknown>;

  return (
    isIntegerInRange(settings.max_n, 1, 8) &&
    isIntegerInRange(settings.max_upload_mb, 1, 100) &&
    (settings.max_size_tier === "2K" || settings.max_size_tier === "4K") &&
    typeof settings.allow_moderation_low === "boolean" &&
    typeof settings.community_enabled === "boolean" &&
    typeof settings.public_publish_enabled === "boolean" &&
    typeof settings.stream_enabled === "boolean"
  );
}

function isIntegerInRange(value: unknown, min: number, max: number) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}
