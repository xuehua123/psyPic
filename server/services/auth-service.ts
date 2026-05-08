import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cacheDatabaseAuthSession } from "@/server/services/dev-store";
import { createId } from "@/server/services/key-binding-service";
import type { PsyPicSession } from "@/server/services/session-service";

const scryptAsync = promisify(scrypt);
const passwordKeyLength = 64;
const sessionTtlMs = 30 * 24 * 60 * 60 * 1000;

export type AuthUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "user" | "admin";
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type AuthSession = PsyPicSession & {
  key_binding_id: string;
};

type PrismaUserRow = {
  id: string;
  email: string | null;
  emailNormalized: string | null;
  displayName: string | null;
  role: "user" | "admin";
  passwordHash: string | null;
  passwordSalt: string | null;
  status: "active" | "disabled";
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

type PrismaSessionRow = {
  id: string;
  userId: string;
  keyBindingId: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  user?: PrismaUserRow | null;
};

type PrismaAuthClient = {
  user: {
    create(input: { data: Record<string, unknown> }): Promise<PrismaUserRow>;
    findFirst(input: Record<string, unknown>): Promise<PrismaUserRow | null>;
    findUnique(input: Record<string, unknown>): Promise<PrismaUserRow | null>;
    update(input: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<PrismaUserRow>;
  };
  session: {
    create(input: {
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaSessionRow>;
    findFirst(input: Record<string, unknown>): Promise<PrismaSessionRow | null>;
    update(input: {
      where: { id: string };
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaSessionRow>;
  };
};

declare global {
  var __psypicAuthPrismaClient: PrismaAuthClient | null | undefined;
}

export async function createUserWithPassword(input: {
  email: string;
  password: string;
  displayName?: string | null;
}): Promise<
  | { status: "ok"; user: AuthUser }
  | { status: "duplicate_email" }
  | { status: "unavailable" }
> {
  const client = await getPrismaAuthClient();
  if (!client) {
    return { status: "unavailable" };
  }

  const emailNormalized = normalizeEmail(input.email);
  const existing = await client.user.findUnique({
    where: { emailNormalized }
  });
  if (existing) {
    return { status: "duplicate_email" };
  }

  const passwordSalt = createId("salt");
  const passwordHash = await hashPassword(input.password, passwordSalt);

  try {
    const user = await client.user.create({
      data: {
        id: createId("user"),
        email: emailNormalized,
        emailNormalized,
        displayName: input.displayName?.trim() || null,
        role: "user",
        status: "active",
        passwordHash,
        passwordSalt
      }
    });

    return { status: "ok", user: fromPrismaUser(user) };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { status: "duplicate_email" };
    }

    throw error;
  }
}

export async function verifyUserPassword(input: {
  email: string;
  password: string;
}): Promise<
  | { status: "ok"; user: AuthUser }
  | { status: "invalid_credentials" }
  | { status: "disabled" }
  | { status: "unavailable" }
> {
  const client = await getPrismaAuthClient();
  if (!client) {
    return { status: "unavailable" };
  }

  const user = await client.user.findUnique({
    where: { emailNormalized: normalizeEmail(input.email) }
  });

  if (!user?.passwordHash || !user.passwordSalt) {
    return { status: "invalid_credentials" };
  }

  const passwordMatches = await verifyPassword(
    input.password,
    user.passwordSalt,
    user.passwordHash
  );
  if (!passwordMatches) {
    return { status: "invalid_credentials" };
  }

  if (user.status !== "active") {
    return { status: "disabled" };
  }

  const updated = await client.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  return { status: "ok", user: fromPrismaUser(updated) };
}

export async function createDatabaseSession(userId: string) {
  const client = await getPrismaAuthClient();
  if (!client) {
    return null;
  }

  const now = new Date();
  const row = await client.session.create({
    data: {
      id: createId("sess"),
      userId,
      keyBindingId: null,
      expiresAt: new Date(now.getTime() + sessionTtlMs),
      createdAt: now,
      lastSeenAt: now
    },
    include: { user: true }
  });
  const authSession = fromPrismaSession(row);

  if (row.user) {
    cacheAuthSession(fromPrismaUser(row.user), authSession);
  }

  return authSession;
}

export async function getDatabaseSession(sessionId: string) {
  const client = await getPrismaAuthClient();
  if (!client || !sessionId) {
    return null;
  }

  const row = await client.session.findFirst({
    where: { id: sessionId },
    include: { user: true }
  });

  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (!row.user || row.user.status !== "active") {
    return null;
  }

  const updated = await client.session.update({
    where: { id: row.id },
    data: { lastSeenAt: new Date() },
    include: { user: true }
  });
  const session = fromPrismaSession(updated);
  const user = updated.user ? fromPrismaUser(updated.user) : fromPrismaUser(row.user);
  cacheAuthSession(user, session);

  return { session, user };
}

export async function revokeSession(sessionId: string) {
  const client = await getPrismaAuthClient();
  if (!client || !sessionId) {
    return false;
  }

  try {
    await client.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
    return true;
  } catch {
    return false;
  }
}

export async function serializeAuthResult(user: AuthUser, session: AuthSession) {
  cacheAuthSession(user, session);

  return {
    authenticated: true,
    user: serializeAuthUser(user)
  };
}

export function serializeAuthUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    last_login_at: user.last_login_at
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase();
}

async function hashPassword(password: string, salt: string) {
  const derivedKey = (await scryptAsync(
    password,
    salt,
    passwordKeyLength
  )) as Buffer;

  return derivedKey.toString("base64url");
}

async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actualHash = Buffer.from(await hashPassword(password, salt), "base64url");
  const expected = Buffer.from(expectedHash, "base64url");

  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

async function getPrismaAuthClient() {
  if (globalThis.__psypicAuthPrismaClient !== undefined) {
    return globalThis.__psypicAuthPrismaClient;
  }

  if (!shouldUseDatabaseAuthStore()) {
    globalThis.__psypicAuthPrismaClient = null;
    return null;
  }

  try {
    const prismaClientPackage = "@prisma/client";
    const prismaModule = (await import(
      /* turbopackIgnore: true */ prismaClientPackage
    )) as {
      PrismaClient?: new () => PrismaAuthClient;
    };

    globalThis.__psypicAuthPrismaClient = prismaModule.PrismaClient
      ? new prismaModule.PrismaClient()
      : null;
  } catch {
    globalThis.__psypicAuthPrismaClient = null;
  }

  return globalThis.__psypicAuthPrismaClient;
}

function shouldUseDatabaseAuthStore() {
  const mode = process.env.PSYPIC_AUTH_STORE?.trim().toLowerCase();

  if (mode === "memory" || mode === "dev") {
    return false;
  }

  return (
    mode === "database" ||
    mode === "db" ||
    (process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL))
  );
}

function fromPrismaUser(row: PrismaUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    display_name: row.displayName,
    role: row.role,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    last_login_at: row.lastLoginAt?.toISOString() ?? null
  };
}

function fromPrismaSession(row: PrismaSessionRow): AuthSession {
  return {
    id: row.id,
    user_id: row.userId,
    key_binding_id: row.keyBindingId ?? "",
    expires_at: row.expiresAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    last_seen_at: row.lastSeenAt.toISOString(),
    revoked_at: row.revokedAt?.toISOString()
  };
}

function cacheAuthSession(user: AuthUser, session: AuthSession) {
  cacheDatabaseAuthSession({
    user: {
      id: user.id,
      display_name: user.display_name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    },
    session
  });
}

function isUniqueConstraintError(error: unknown) {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    (error as Record<string, unknown>).code === "P2002"
  );
}
