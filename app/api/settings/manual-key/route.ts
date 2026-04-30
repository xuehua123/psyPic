import { manualKeySchema } from "@/lib/validation/import";
import { createManualKeySession } from "@/server/services/dev-store";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { buildSessionCookie } from "@/server/services/session-service";

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

  const bound = createManualKeySession({
    baseUrl: parsed.data.base_url,
    apiKey: parsed.data.api_key,
    defaultModel: parsed.data.default_model
  });

  return jsonOk(
    {
      session_bound: true,
      binding_id: bound.binding.id,
      base_url: bound.binding.sub2api_base_url,
      default_model: bound.binding.default_model,
      enabled_models: bound.binding.enabled_models,
      limits: {
        max_n: bound.binding.limits.max_n,
        max_size_tier: bound.binding.limits.max_size_tier,
        allow_moderation_low: bound.binding.limits.allow_moderation_low
      }
    },
    requestId,
    {
      headers: {
        "set-cookie": buildSessionCookie(bound.session.id)
      }
    }
  );
}
