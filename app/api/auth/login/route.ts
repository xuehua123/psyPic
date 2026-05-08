import { loginSchema } from "@/lib/validation/auth";
import {
  createDatabaseSession,
  serializeAuthResult,
  verifyUserPassword
} from "@/server/services/auth-service";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { buildSessionCookie } from "@/server/services/session-service";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

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

  const verified = await verifyUserPassword(parsed.data);

  if (verified.status === "invalid_credentials") {
    return jsonError({
      status: 401,
      code: "invalid_credentials",
      message: "邮箱或密码错误",
      requestId
    });
  }

  if (verified.status === "disabled") {
    return jsonError({
      status: 403,
      code: "user_disabled",
      message: "账号已停用",
      requestId
    });
  }

  if (verified.status === "unavailable") {
    return jsonError({
      status: 503,
      code: "auth_store_unavailable",
      message: "身份服务暂不可用",
      requestId
    });
  }

  const session = await createDatabaseSession(verified.user.id);
  if (!session) {
    return jsonError({
      status: 503,
      code: "auth_store_unavailable",
      message: "身份服务暂不可用",
      requestId
    });
  }

  return jsonOk(await serializeAuthResult(verified.user, session), requestId, {
    headers: {
      "set-cookie": buildSessionCookie(session.id)
    }
  });
}
