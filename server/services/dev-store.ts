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
  consumedAt?: string;
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

export function createSessionFromImportCode(importCode: string) {
  const record = consumeImportCode(importCode);

  if (!record) {
    return null;
  }

  return createBoundSession({
    baseUrl: record.baseUrl,
    apiKey: record.apiKey,
    apiKeyId: record.apiKeyId,
    displayName: "Sub2API User",
    sub2apiUserId: record.sub2apiUserId
  });
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

function seedImportCodes() {
  store.importCodes.set("valid_one_time_code", {
    code: "valid_one_time_code",
    apiKey: createId("devkey"),
    apiKeyId: "sub2api_key_fixture",
    sub2apiUserId: "sub2api_user_fixture",
    baseUrl: "https://sub2api.example.com/v1"
  });
}

seedImportCodes();
