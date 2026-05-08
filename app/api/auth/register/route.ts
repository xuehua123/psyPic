import { registerSchema } from "@/lib/validation/auth";
import {
  createDatabaseSession,
  createUserWithPassword,
  serializeAuthResult
} from "@/server/services/auth-service";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { buildSessionCookie } from "@/server/services/session-service";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]?.toString() ?? "request";

    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.error.issues[0]?.message ?? "参数错误",
      field,
      requestId
    });
  }

  const created = await createUserWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    displayName: parsed.data.display_name
  });

  if (created.status === "duplicate_email") {
    return jsonError({
      status: 409,
      code: "email_already_registered",
      message: "邮箱已注册",
      field: "email",
      requestId
    });
  }

  if (created.status === "unavailable") {
    return jsonError({
      status: 503,
      code: "auth_store_unavailable",
      message: "身份服务暂不可用",
      requestId
    });
  }

  const session = await createDatabaseSession(created.user.id);
  if (!session) {
    return jsonError({
      status: 503,
      code: "auth_store_unavailable",
      message: "身份服务暂不可用",
      requestId
    });
  }

  return jsonOk(await serializeAuthResult(created.user, session), requestId, {
    headers: {
      "set-cookie": buildSessionCookie(session.id)
    }
  });
}
