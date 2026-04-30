import { parseGenerationParams } from "@/lib/validation/image-params";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getKeyBinding, getSession } from "@/server/services/dev-store";
import { decryptKeyBindingSecret, createId } from "@/server/services/key-binding-service";
import {
  generateImageWithSub2API,
  Sub2APIError
} from "@/server/services/sub2api-client";
import { createTempAssetFromBase64 } from "@/server/services/temp-asset-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先导入或配置 Sub2API Key",
      requestId
    });
  }

  const binding = getKeyBinding(session.key_binding_id);

  if (!binding || binding.status !== "active") {
    return jsonError({
      status: 403,
      code: "forbidden",
      message: "当前 session 没有关联可用 key binding",
      requestId
    });
  }

  const parsed = parseGenerationParams(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: parsed.error.code,
      message: parsed.error.message,
      field: parsed.error.details.field,
      requestId
    });
  }

  if (parsed.data.n > binding.limits.max_n) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: `数量不能超过 ${binding.limits.max_n}`,
      field: "n",
      requestId
    });
  }

  const startedAt = Date.now();
  const taskId = createId("task");

  try {
    const upstream = await generateImageWithSub2API({
      baseUrl: binding.sub2api_base_url,
      apiKey: decryptKeyBindingSecret(binding),
      params: parsed.data
    });
    const images = await Promise.all(
      upstream.images.map(async (image) => {
        const asset = await createTempAssetFromBase64({
          userId: session.user_id,
          taskId,
          b64Json: image.b64_json,
          format: parsed.data.output_format
        });

        return {
          asset_id: asset.id,
          url: `/api/assets/${asset.id}`,
          width: asset.width,
          height: asset.height,
          format: parsed.data.output_format
        };
      })
    );

    return jsonOk(
      {
        task_id: taskId,
        images,
        usage: upstream.usage,
        duration_ms: Date.now() - startedAt
      },
      requestId,
      {
        upstreamRequestId: upstream.upstreamRequestId
      }
    );
  } catch (error) {
    if (error instanceof Sub2APIError) {
      return jsonError({
        status: error.status,
        code: error.code,
        message: error.message,
        requestId,
        upstreamRequestId: error.upstreamRequestId
      });
    }

    return jsonError({
      status: 502,
      code: "upstream_error",
      message: "图片生成失败",
      requestId
    });
  }
}
