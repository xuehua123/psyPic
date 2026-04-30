import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID
} from "node:crypto";

const CIPHER_ALGORITHM = "aes-256-gcm";
const CIPHER_VERSION = "v1";

export type KeyBindingLimits = {
  max_n: number;
  max_upload_mb: number;
  max_size_tier: "2K" | "4K";
  allow_moderation_low: boolean;
};

export type KeyBinding = {
  id: string;
  user_id: string;
  sub2api_base_url: string;
  sub2api_api_key_ciphertext: string;
  sub2api_api_key_id?: string;
  default_model: "gpt-image-2";
  enabled_models: string[];
  limits: KeyBindingLimits;
  status: "active" | "disabled" | "expired";
  created_at: string;
  updated_at: string;
};

export type CreateEncryptedKeyBindingInput = {
  userId: string;
  baseUrl: string;
  apiKey: string;
  apiKeyId?: string;
  defaultModel?: "gpt-image-2";
  enabledModels?: string[];
  limits?: Partial<KeyBindingLimits>;
};

export function createEncryptedKeyBinding(
  input: CreateEncryptedKeyBindingInput
): KeyBinding {
  const now = new Date().toISOString();

  return {
    id: createId("kb"),
    user_id: input.userId,
    sub2api_base_url: normalizeBaseUrl(input.baseUrl),
    sub2api_api_key_ciphertext: encryptSecret(input.apiKey),
    sub2api_api_key_id: input.apiKeyId,
    default_model: input.defaultModel ?? "gpt-image-2",
    enabled_models: input.enabledModels ?? ["gpt-image-2"],
    limits: {
      max_n: input.limits?.max_n ?? 4,
      max_upload_mb: input.limits?.max_upload_mb ?? 20,
      max_size_tier: input.limits?.max_size_tier ?? "2K",
      allow_moderation_low: input.limits?.allow_moderation_low ?? false
    },
    status: "active",
    created_at: now,
    updated_at: now
  };
}

export function decryptKeyBindingSecret(binding: Pick<KeyBinding, "sub2api_api_key_ciphertext">) {
  return decryptSecret(binding.sub2api_api_key_ciphertext);
}

export function redactSensitiveValue(value: string) {
  if (/(authorization|bearer|api[_-]?key|psypic_session|secret-token|sk-)/i.test(value)) {
    return "[REDACTED]";
  }

  return value;
}

export function createId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER_ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [
    CIPHER_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}

function decryptSecret(payload: string) {
  const [version, iv, authTag, ciphertext] = payload.split(".");

  if (version !== CIPHER_VERSION || !iv || !authTag || !ciphertext) {
    throw new Error("Unsupported key binding cipher payload");
  }

  const decipher = createDecipheriv(
    CIPHER_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function getEncryptionKey() {
  const secret =
    process.env.KEY_ENCRYPTION_SECRET ??
    "psypic-development-only-key-encryption-secret";

  return createHash("sha256").update(secret).digest();
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}
