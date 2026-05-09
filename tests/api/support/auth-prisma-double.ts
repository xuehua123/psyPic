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
};

type KeyBindingRow = {
  id: string;
  userId: string;
  sub2apiBaseUrl: string;
  sub2apiApiKeyCiphertext: string | null;
  sub2apiApiKeyId: string | null;
  defaultModel: string;
  enabledModels: unknown;
  limits: unknown;
  status: "active" | "disabled" | "expired";
  createdAt: Date;
  updatedAt: Date;
};

export function installAuthPrismaDouble() {
  const client = createAuthPrismaDouble();
  (
    globalThis as unknown as {
      __psypicAuthPrismaClient?: ReturnType<typeof createAuthPrismaDouble>;
    }
  ).__psypicAuthPrismaClient = client;

  return client;
}

export function clearAuthPrismaDouble() {
  (
    globalThis as unknown as {
      __psypicAuthPrismaClient?: ReturnType<typeof createAuthPrismaDouble>;
    }
  ).__psypicAuthPrismaClient = undefined;
}

export function createAuthPrismaDouble() {
  const users = new Map<string, AuthUserRow>();
  const sessions = new Map<string, AuthSessionRow>();
  const keyBindings = new Map<string, KeyBindingRow>();

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
        Array.from(users.values()).find((user) => matchesWhere(user, where)) ??
        null,
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        Array.from(users.values()).find((user) => matchesWhere(user, where)) ??
        null,
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
            matchesWhere(session, where)
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
    },
    keyBinding: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date("2026-05-09T00:00:00.000Z");
        const row = {
          id: String(data.id),
          userId: String(data.userId),
          sub2apiBaseUrl: String(data.sub2apiBaseUrl),
          sub2apiApiKeyCiphertext:
            typeof data.sub2apiApiKeyCiphertext === "string"
              ? data.sub2apiApiKeyCiphertext
              : null,
          sub2apiApiKeyId:
            typeof data.sub2apiApiKeyId === "string"
              ? data.sub2apiApiKeyId
              : null,
          defaultModel:
            typeof data.defaultModel === "string"
              ? data.defaultModel
              : "gpt-image-2",
          enabledModels: data.enabledModels ?? ["gpt-image-2"],
          limits: data.limits ?? {},
          status:
            data.status === "disabled" || data.status === "expired"
              ? data.status
              : "active",
          createdAt: data.createdAt instanceof Date ? data.createdAt : now,
          updatedAt: data.updatedAt instanceof Date ? data.updatedAt : now
        } satisfies KeyBindingRow;
        keyBindings.set(row.id, row);
        return row;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        Array.from(keyBindings.values()).find((binding) =>
          matchesWhere(binding, where)
        ) ?? null
    },
    __getSession: (sessionId: string) => sessions.get(sessionId) ?? null,
    __getKeyBinding: (bindingId: string) => keyBindings.get(bindingId) ?? null
  };
}

function matchesWhere<T extends Record<string, unknown>>(
  row: T,
  where: Record<string, unknown>
) {
  return Object.entries(where).every(
    ([key, value]) => row[key as keyof T] === value
  );
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
