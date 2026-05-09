import { beforeEach, describe, expect, it } from "vitest";
import { GET as listAuditLogs } from "@/app/api/admin/audit-logs/route";
import { GET as getUsage } from "@/app/api/usage/route";
import { cacheDatabaseAuthSession, resetDevStore } from "@/server/services/dev-store";
import { resetImageTaskStore } from "@/server/services/image-task-service";

type AuthUserRow = {
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

type AuthSessionRow = {
  id: string;
  userId: string;
  keyBindingId: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
};

describe("auth boundary closure", () => {
  beforeEach(() => {
    resetDevStore();
    resetImageTaskStore();
    (
      globalThis as unknown as {
        __psypicAuthPrismaClient?: ReturnType<typeof createAuthPrismaDouble>;
      }
    ).__psypicAuthPrismaClient = createAuthPrismaDouble();
  });

  it("resolves a private API user from the database session without dev-store state", async () => {
    const prismaClient = (
      globalThis as unknown as {
        __psypicAuthPrismaClient: ReturnType<typeof createAuthPrismaDouble>;
      }
    ).__psypicAuthPrismaClient;
    await prismaClient.user.create({
      data: {
        id: "user_private_db",
        email: "private@example.com",
        emailNormalized: "private@example.com",
        displayName: "Private DB User",
        role: "user",
        status: "active"
      }
    });
    await prismaClient.session.create({
      data: {
        id: "sess_private_db",
        userId: "user_private_db",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-09T00:00:00.000Z"),
        lastSeenAt: new Date("2026-05-09T00:00:00.000Z")
      }
    });
    resetDevStore();

    const response = await getUsage(
      new Request("http://localhost/api/usage", {
        headers: { cookie: "psypic_session=sess_private_db" }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      task_count: 0,
      image_count: 0,
      total_tokens: 0
    });
  });

  it("resolves admin APIs from a database admin session without dev-store state", async () => {
    const prismaClient = (
      globalThis as unknown as {
        __psypicAuthPrismaClient: ReturnType<typeof createAuthPrismaDouble>;
      }
    ).__psypicAuthPrismaClient;
    await prismaClient.user.create({
      data: {
        id: "user_admin_db",
        email: "admin@example.com",
        emailNormalized: "admin@example.com",
        displayName: "Admin DB User",
        role: "admin",
        status: "active"
      }
    });
    await prismaClient.session.create({
      data: {
        id: "sess_admin_db",
        userId: "user_admin_db",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-09T00:00:00.000Z"),
        lastSeenAt: new Date("2026-05-09T00:00:00.000Z")
      }
    });
    resetDevStore();

    const response = await listAuditLogs(
      new Request("http://localhost/api/admin/audit-logs", {
        headers: { cookie: "psypic_session=sess_admin_db" }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it("does not fall back to cached dev-store auth after database session revocation", async () => {
    const prismaClient = (
      globalThis as unknown as {
        __psypicAuthPrismaClient: ReturnType<typeof createAuthPrismaDouble>;
      }
    ).__psypicAuthPrismaClient;
    await prismaClient.user.create({
      data: {
        id: "user_revoked_db",
        email: "revoked@example.com",
        emailNormalized: "revoked@example.com",
        displayName: "Revoked DB User",
        role: "user",
        status: "active"
      }
    });
    await prismaClient.session.create({
      data: {
        id: "sess_revoked_db",
        userId: "user_revoked_db",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-09T00:00:00.000Z"),
        lastSeenAt: new Date("2026-05-09T00:00:00.000Z")
      }
    });
    const cookie = "psypic_session=sess_revoked_db";

    const warmCache = await getUsage(
      new Request("http://localhost/api/usage", {
        headers: { cookie }
      })
    );
    expect(warmCache.status).toBe(200);

    await prismaClient.session.update({
      where: { id: "sess_revoked_db" },
      data: { revokedAt: new Date("2026-05-09T00:01:00.000Z") }
    });

    const response = await getUsage(
      new Request("http://localhost/api/usage", {
        headers: { cookie }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });

  it("fails closed instead of using dev-store cache when database auth lookup is unavailable", async () => {
    const previousAuthStore = process.env.PSYPIC_AUTH_STORE;
    process.env.PSYPIC_AUTH_STORE = "database";
    (
      globalThis as unknown as {
        __psypicAuthPrismaClient?: ReturnType<
          typeof createUnavailableAuthPrismaDouble
        >;
      }
    ).__psypicAuthPrismaClient = createUnavailableAuthPrismaDouble();
    cacheDatabaseAuthSession({
      user: {
        id: "user_db_down",
        display_name: "Cached DB User",
        role: "user",
        created_at: "2026-05-09T00:00:00.000Z",
        updated_at: "2026-05-09T00:00:00.000Z"
      },
      session: {
        id: "sess_db_down",
        user_id: "user_db_down",
        key_binding_id: "",
        expires_at: "2099-01-01T00:00:00.000Z",
        created_at: "2026-05-09T00:00:00.000Z",
        last_seen_at: "2026-05-09T00:00:00.000Z"
      }
    });

    try {
      const response = await getUsage(
        new Request("http://localhost/api/usage", {
          headers: { cookie: "psypic_session=sess_db_down" }
        })
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe("unauthorized");
    } finally {
      restoreEnv("PSYPIC_AUTH_STORE", previousAuthStore);
    }
  });
});

function createAuthPrismaDouble() {
  const users = new Map<string, AuthUserRow>();
  const sessions = new Map<string, AuthSessionRow>();

  return {
    user: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date("2026-05-09T00:00:00.000Z");
        const row = {
          id: String(data.id),
          email: typeof data.email === "string" ? data.email : null,
          emailNormalized:
            typeof data.emailNormalized === "string" ? data.emailNormalized : null,
          displayName:
            typeof data.displayName === "string" ? data.displayName : null,
          role: data.role === "admin" ? "admin" : "user",
          passwordHash:
            typeof data.passwordHash === "string" ? data.passwordHash : null,
          passwordSalt:
            typeof data.passwordSalt === "string" ? data.passwordSalt : null,
          status: data.status === "disabled" ? "disabled" : "active",
          createdAt: data.createdAt instanceof Date ? data.createdAt : now,
          updatedAt: data.updatedAt instanceof Date ? data.updatedAt : now,
          lastLoginAt: data.lastLoginAt instanceof Date ? data.lastLoginAt : null
        } satisfies AuthUserRow;
        users.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        Array.from(users.values()).find((user) =>
          Object.entries(where).every(
            ([key, value]) => user[key as keyof AuthUserRow] === value
          )
        ) ?? null,
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        Array.from(users.values()).find((user) =>
          Object.entries(where).every(
            ([key, value]) => user[key as keyof AuthUserRow] === value
          )
        ) ?? null,
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = users.get(where.id);
        if (!current) throw new Error("missing user");
        const row = { ...current, ...data } as AuthUserRow;
        users.set(row.id, row);
        return row;
      }
    },
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: String(data.id),
          userId: String(data.userId),
          keyBindingId:
            typeof data.keyBindingId === "string" ? data.keyBindingId : null,
          expiresAt:
            data.expiresAt instanceof Date ? data.expiresAt : new Date(),
          createdAt:
            data.createdAt instanceof Date ? data.createdAt : new Date(),
          lastSeenAt:
            data.lastSeenAt instanceof Date ? data.lastSeenAt : new Date(),
          revokedAt: data.revokedAt instanceof Date ? data.revokedAt : null
        } satisfies AuthSessionRow;
        sessions.set(row.id, row);
        return withSessionUser(row, users);
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row =
          Array.from(sessions.values()).find((session) =>
            Object.entries(where).every(
              ([key, value]) => session[key as keyof AuthSessionRow] === value
            )
          ) ?? null;
        return row ? withSessionUser(row, users) : null;
      },
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = sessions.get(where.id);
        if (!current) throw new Error("missing session");
        const row = { ...current, ...data } as AuthSessionRow;
        sessions.set(row.id, row);
        return withSessionUser(row, users);
      }
    }
  };
}

function withSessionUser(
  session: AuthSessionRow,
  users: Map<string, AuthUserRow>
) {
  return {
    ...session,
    user: users.get(session.userId)
  };
}

function createUnavailableAuthPrismaDouble() {
  const unavailable = async () => {
    throw new Error("database unavailable");
  };

  return {
    user: {
      create: unavailable,
      findFirst: unavailable,
      findUnique: unavailable,
      update: unavailable
    },
    session: {
      create: unavailable,
      findFirst: unavailable,
      update: unavailable
    }
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
