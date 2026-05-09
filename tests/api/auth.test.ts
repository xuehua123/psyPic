import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as getSession } from "@/app/api/session/route";
import {
  listAuditLogs,
  resetAuditLogStore
} from "@/server/services/audit-log-service";
import { resetDevStore } from "@/server/services/dev-store";

type AuthUserRow = {
  id: string;
  email: string | null;
  emailNormalized: string | null;
  displayName: string | null;
  role: "user" | "admin";
  passwordHash: string | null;
  passwordSalt: string | null;
  status: "active" | "disabled";
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AuthSessionRow = {
  id: string;
  userId: string;
  keyBindingId: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  user?: AuthUserRow;
};

function authRequest(path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function extractCookie(response: Response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

describe("auth API", () => {
  beforeEach(() => {
    resetDevStore();
    resetAuditLogStore();
    const prismaClient = createAuthPrismaDouble();
    (
      globalThis as unknown as {
        __psypicAuthPrismaClient?: ReturnType<typeof createAuthPrismaDouble>;
      }
    ).__psypicAuthPrismaClient = prismaClient;
  });

  it("registers a database-backed user and returns a safe current session", async () => {
    const registerResponse = await register(
      authRequest("/api/auth/register", {
        email: "Ada@Example.com",
        password: "correct horse battery staple",
        display_name: "Ada"
      })
    );
    const registerBody = await registerResponse.json();
    const cookie = extractCookie(registerResponse);

    expect(registerResponse.status).toBe(200);
    expect(cookie).toMatch(/^psypic_session=sess_/);
    expect(registerResponse.headers.get("set-cookie")).toContain("HttpOnly");
    expect(registerResponse.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(registerBody.data.user).toMatchObject({
      email: "ada@example.com",
      display_name: "Ada"
    });
    expect(JSON.stringify(registerBody)).not.toContain("passwordHash");
    expect(JSON.stringify(registerBody)).not.toContain("passwordSalt");

    const sessionResponse = await getSession(
      authRequest("/api/session", undefined, cookie)
    );
    const sessionBody = await sessionResponse.json();

    expect(sessionResponse.status).toBe(200);
    expect(sessionBody.data.authenticated).toBe(true);
    expect(sessionBody.data.user.email).toBe("ada@example.com");
    expect(sessionBody.data.binding).toBeNull();
    expect(JSON.stringify(sessionBody)).not.toContain("password");
    expect(JSON.stringify(sessionBody)).not.toContain("ciphertext");
  });

  it("rejects duplicate email registration", async () => {
    await register(
      authRequest("/api/auth/register", {
        email: "ada@example.com",
        password: "correct horse battery staple"
      })
    );

    const response = await register(
      authRequest("/api/auth/register", {
        email: "ADA@example.com",
        password: "correct horse battery staple"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("email_already_registered");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("logs in with a password and updates the current session", async () => {
    await register(
      authRequest("/api/auth/register", {
        email: "login@example.com",
        password: "correct horse battery staple",
        display_name: "Login User"
      })
    );

    const response = await login(
      authRequest("/api/auth/login", {
        email: "LOGIN@example.com",
        password: "correct horse battery staple"
      })
    );
    const body = await response.json();
    const cookie = extractCookie(response);

    expect(response.status).toBe(200);
    expect(cookie).toMatch(/^psypic_session=sess_/);
    expect(body.data.authenticated).toBe(true);
    expect(body.data.user.email).toBe("login@example.com");
    expect(JSON.stringify(body)).not.toContain("passwordHash");

    const auditLogs = await listAuditLogs({ limit: 10 });
    expect(auditLogs.items[0]).toMatchObject({
      actor_user_id: body.data.user.id,
      action: "auth.login.succeeded",
      target_type: "user",
      target_id: body.data.user.id,
      request_id: body.request_id
    });
    expect(JSON.stringify(auditLogs)).not.toContain("correct horse");
    expect(JSON.stringify(auditLogs)).not.toContain("password");
  });

  it("rejects login with the wrong password", async () => {
    await register(
      authRequest("/api/auth/register", {
        email: "wrong@example.com",
        password: "correct horse battery staple"
      })
    );

    const response = await login(
      authRequest("/api/auth/login", {
        email: "wrong@example.com",
        password: "totally incorrect"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("invalid_credentials");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("treats expired database sessions as anonymous", async () => {
    const prismaClient = (
      globalThis as unknown as {
        __psypicAuthPrismaClient: ReturnType<typeof createAuthPrismaDouble>;
      }
    ).__psypicAuthPrismaClient;
    const user = await prismaClient.user.create({
      data: {
        id: "user_expired",
        email: "expired@example.com",
        emailNormalized: "expired@example.com",
        displayName: "Expired",
        role: "user",
        passwordHash: "unused",
        passwordSalt: "unused",
        status: "active"
      }
    });
    const session = await prismaClient.session.create({
      data: {
        id: "sess_expired",
        userId: user.id,
        keyBindingId: null,
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
        createdAt: new Date("2000-01-01T00:00:00.000Z"),
        lastSeenAt: new Date("2000-01-01T00:00:00.000Z")
      }
    });

    const response = await getSession(
      authRequest("/api/session", undefined, `psypic_session=${session.id}`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.authenticated).toBe(false);
  });

  it("revokes the database session on logout", async () => {
    const registerResponse = await register(
      authRequest("/api/auth/register", {
        email: "logout@example.com",
        password: "correct horse battery staple"
      })
    );
    const cookie = extractCookie(registerResponse);
    const sessionId = cookie.replace("psypic_session=", "");

    const logoutResponse = await logout(
      authRequest("/api/auth/logout", {}, cookie)
    );
    const sessionResponse = await getSession(
      authRequest("/api/session", undefined, cookie)
    );
    const sessionBody = await sessionResponse.json();

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(sessionBody.data.authenticated).toBe(false);

    const auditLogs = await listAuditLogs({ limit: 10 });
    const logoutBody = await logoutResponse.json();
    expect(auditLogs.items[0]).toMatchObject({
      action: "auth.logout",
      target_type: "session",
      target_id: sessionId,
      request_id: logoutBody.request_id
    });
    expect(auditLogs.items[0].actor_user_id).toMatch(/^user_/);
  });
});

function createAuthPrismaDouble() {
  const users = new Map<string, AuthUserRow>();
  const sessions = new Map<string, AuthSessionRow>();

  return {
    user: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (
          typeof data.emailNormalized === "string" &&
          Array.from(users.values()).some(
            (user) => user.emailNormalized === data.emailNormalized
          )
        ) {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002"
          });
        }
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
          emailVerifiedAt:
            data.emailVerifiedAt instanceof Date ? data.emailVerifiedAt : null,
          lastLoginAt: data.lastLoginAt instanceof Date ? data.lastLoginAt : null,
          createdAt: data.createdAt instanceof Date ? data.createdAt : now,
          updatedAt: data.updatedAt instanceof Date ? data.updatedAt : now
        } satisfies AuthUserRow;
        users.set(row.id, row);
        return row;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        Array.from(users.values()).find((user) =>
          Object.entries(where).every(
            ([key, value]) => user[key as keyof AuthUserRow] === value
          )
        ) ?? null,
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
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
        if (!current) {
          throw new Error("missing user");
        }
        const row = {
          ...current,
          ...data,
          updatedAt: new Date("2026-05-09T00:00:01.000Z")
        } as AuthUserRow;
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
        if (!current) {
          throw new Error("missing session");
        }
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
