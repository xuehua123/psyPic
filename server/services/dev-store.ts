import {
  createEncryptedKeyBinding,
  createId,
  type KeyBinding
} from "@/server/services/key-binding-service";
import { createSession, type PsyPicSession } from "@/server/services/session-service";

export type DevUser = {
  id: string;
  sub2api_user_id?: string;
  display_name: string;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
};

type ImportCodeRecord = {
  code: string;
  apiKey: string;
  apiKeyId: string;
  sub2apiUserId: string;
  baseUrl: string;
  expiresAt?: string;
  keyStatus?: "active" | "inactive";
  quotaRemaining?: number;
  ownerMatches?: boolean;
  group?: "OpenAI" | "Other";
  consumedAt?: string;
};

export type ImportExchangeResult =
  | {
      ok: true;
      bound: ReturnType<typeof createBoundSession>;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

type DevStore = {
  users: Map<string, DevUser>;
  sessions: Map<string, PsyPicSession>;
  keyBindings: Map<string, KeyBinding>;
  importCodes: Map<string, ImportCodeRecord>;
};

declare global {
  var __psypicDevStore: DevStore | undefined;
}

const store = globalThis.__psypicDevStore ?? createEmptyStore();
globalThis.__psypicDevStore = store;

export function resetDevStore() {
  store.users.clear();
  store.sessions.clear();
  store.keyBindings.clear();
  store.importCodes.clear();
  seedImportCodes();
}

export function consumeImportCode(importCode: string) {
  const record = store.importCodes.get(importCode);

  if (!record || record.consumedAt) {
    return null;
  }

  record.consumedAt = new Date().toISOString();
  return record;
}

export function createSessionFromImportCode(
  importCode: string
): ImportExchangeResult {
  const record = store.importCodes.get(importCode);

  if (!record) {
    return importExchangeError(
      400,
      "invalid_import_code",
      "导入 code 无效或已被消费"
    );
  }

  if (record.consumedAt) {
    return importExchangeError(
      400,
      "invalid_import_code",
      "导入 code 无效或已被消费"
    );
  }

  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
    return importExchangeError(400, "import_code_expired", "导入 ticket 已过期");
  }

  if (record.keyStatus === "inactive") {
    return importExchangeError(403, "key_inactive", "Sub2API Key 当前不可用");
  }

  if (record.quotaRemaining !== undefined && record.quotaRemaining <= 0) {
    return importExchangeError(
      403,
      "key_quota_exhausted",
      "Sub2API Key 额度不足"
    );
  }

  if (record.ownerMatches === false) {
    return importExchangeError(
      403,
      "key_owner_mismatch",
      "Sub2API Key 不属于当前用户"
    );
  }

  if (record.group && record.group !== "OpenAI") {
    return importExchangeError(
      403,
      "invalid_key_group",
      "Sub2API Key 分组不允许调用 OpenAI Images API"
    );
  }

  record.consumedAt = new Date().toISOString();
  const bound = createBoundSession({
    baseUrl: record.baseUrl,
    apiKey: record.apiKey,
    apiKeyId: record.apiKeyId,
    displayName: "Sub2API User",
    sub2apiUserId: record.sub2apiUserId
  });

  return { ok: true, bound };
}

export function createManualKeySession(input: {
  baseUrl: string;
  apiKey: string;
  defaultModel: "gpt-image-2";
}) {
  return createBoundSession({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    displayName: "Manual Development User"
  });
}

export function createAdminSessionForDev() {
  const bound = createBoundSession({
    baseUrl: "https://sub2api.example.com/v1",
    apiKey: createId("adminkey"),
    displayName: "PsyPic Admin"
  });

  bound.user.role = "admin";
  store.users.set(bound.user.id, bound.user);

  return bound;
}

export function getSession(sessionId: string) {
  const session = store.sessions.get(sessionId);

  if (!session || session.revoked_at) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return null;
  }

  session.last_seen_at = new Date().toISOString();
  return session;
}

export function revokeSession(sessionId: string) {
  const session = store.sessions.get(sessionId);

  if (session) {
    session.revoked_at = new Date().toISOString();
  }
}

export function getUser(userId: string) {
  return store.users.get(userId) ?? null;
}

export function getKeyBinding(bindingId: string) {
  return store.keyBindings.get(bindingId) ?? null;
}

export function getKeyBindingForSession(sessionId: string) {
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  return getKeyBinding(session.key_binding_id);
}

function createBoundSession(input: {
  baseUrl: string;
  apiKey: string;
  apiKeyId?: string;
  displayName: string;
  sub2apiUserId?: string;
}) {
  const now = new Date().toISOString();
  const user: DevUser = {
    id: createId("user"),
    sub2api_user_id: input.sub2apiUserId,
    display_name: input.displayName,
    role: "user",
    created_at: now,
    updated_at: now
  };
  const binding = createEncryptedKeyBinding({
    userId: user.id,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    apiKeyId: input.apiKeyId
  });
  const session = createSession(user.id, binding.id);

  store.users.set(user.id, user);
  store.keyBindings.set(binding.id, binding);
  store.sessions.set(session.id, session);

  return { user, binding, session };
}

function createEmptyStore(): DevStore {
  return {
    users: new Map(),
    sessions: new Map(),
    keyBindings: new Map(),
    importCodes: new Map()
  };
}

function importExchangeError(status: number, code: string, message: string) {
  return {
    ok: false as const,
    status,
    code,
    message
  };
}

function seedImportCodes() {
  const baseRecord = {
    apiKey: createId("devkey"),
    apiKeyId: "sub2api_key_fixture",
    sub2apiUserId: "sub2api_user_fixture",
    baseUrl: "https://sub2api.example.com/v1",
    group: "OpenAI" as const,
    keyStatus: "active" as const,
    quotaRemaining: 10,
    ownerMatches: true
  };

  store.importCodes.set("valid_one_time_code", {
    ...baseRecord,
    code: "valid_one_time_code"
  });
  store.importCodes.set("expired_import_code", {
    ...baseRecord,
    code: "expired_import_code",
    expiresAt: "2000-01-01T00:00:00.000Z"
  });
  store.importCodes.set("inactive_key_code", {
    ...baseRecord,
    code: "inactive_key_code",
    keyStatus: "inactive"
  });
  store.importCodes.set("quota_exhausted_code", {
    ...baseRecord,
    code: "quota_exhausted_code",
    quotaRemaining: 0
  });
  store.importCodes.set("foreign_user_code", {
    ...baseRecord,
    code: "foreign_user_code",
    ownerMatches: false
  });
  store.importCodes.set("non_openai_group_code", {
    ...baseRecord,
    code: "non_openai_group_code",
    group: "Other"
  });
}

seedImportCodes();
