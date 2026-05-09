import { manualKeySchema } from "@/lib/validation/import";
import {
  bindManualKeyToDatabaseSession,
  shouldUseDatabaseAuthStore
} from "@/server/services/auth-service";
import { createManualKeySession } from "@/server/services/dev-store";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import {
  buildSessionCookie,
  readSessionIdFromRequest
} from "@/server/services/session-service";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const parsed = manualKeySchema.safeParse(await request.json().catch(() => null));

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

  const sessionId = readSessionIdFromRequest(request);
  if (sessionId) {
    const databaseBound = await bindManualKeyToDatabaseSession({
      sessionId,
      baseUrl: parsed.data.base_url,
      apiKey: parsed.data.api_key,
      defaultModel: parsed.data.default_model
    });

    if (databaseBound.status === "ok") {
      return manualKeyResponse(databaseBound.binding, requestId, {
        "set-cookie": buildSessionCookie(databaseBound.session.id)
      });
    }

    if (shouldUseDatabaseAuthStore()) {
      return jsonError({
        status:
          databaseBound.status === "unavailable"
            ? 503
            : 401,
        code:
          databaseBound.status === "unavailable"
            ? "auth_store_unavailable"
            : "unauthorized",
        message:
          databaseBound.status === "unavailable"
            ? "身份服务暂不可用"
            : "请先登录",
        requestId
      });
    }
  } else if (shouldUseDatabaseAuthStore()) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先登录",
      requestId
    });
  }

  const bound = createManualKeySession({
    baseUrl: parsed.data.base_url,
    apiKey: parsed.data.api_key,
    defaultModel: parsed.data.default_model
  });

  return manualKeyResponse(bound.binding, requestId, {
    "set-cookie": buildSessionCookie(bound.session.id)
  });
}

function manualKeyResponse(
  binding: {
    id: string;
    sub2api_base_url: string;
    default_model: string;
    enabled_models: string[];
    limits: {
      max_n: number;
      max_size_tier: string;
      allow_moderation_low: boolean;
    };
  },
  requestId: string,
  headers: HeadersInit
) {
  return jsonOk(
    {
      session_bound: true,
      binding_id: binding.id,
      base_url: binding.sub2api_base_url,
      default_model: binding.default_model,
      enabled_models: binding.enabled_models,
      limits: {
        max_n: binding.limits.max_n,
        max_size_tier: binding.limits.max_size_tier,
        allow_moderation_low: binding.limits.allow_moderation_low
      }
    },
    requestId,
    {
      headers
    }
  );
}
