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

const defaultRuntimeSettings: RuntimeSettings = {
  max_n: 4,
  max_upload_mb: 20,
  max_size_tier: "2K",
  allow_moderation_low: false,
  community_enabled: true,
  public_publish_enabled: true,
  stream_enabled: true
};

export function getRuntimeSettings(): RuntimeSettings {
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

export function getEffectiveImageLimits(bindingLimits?: KeyBindingLimits) {
  const settings = getRuntimeSettings();

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

export function getRuntimeFeatureFlags() {
  const settings = getRuntimeSettings();

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
