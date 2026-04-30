import { importExchangeSchema } from "@/lib/validation/import";
import { createSessionFromImportCode } from "@/server/services/dev-store";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { buildSessionCookie } from "@/server/services/session-service";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const parsed = importExchangeSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: "import_code 不能为空",
      field: "import_code",
      requestId
    });
  }

  const bound = createSessionFromImportCode(parsed.data.import_code);

  if (!bound) {
    return jsonError({
      status: 400,
      code: "invalid_import_code",
      message: "导入 code 无效或已被消费",
      requestId
    });
  }

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
