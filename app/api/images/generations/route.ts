import {
  parseGenerationParams,
  validateSizeTier
} from "@/lib/validation/image-params";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getKeyBinding, getSession } from "@/server/services/dev-store";
import { recordAuditLog } from "@/server/services/audit-log-service";
import { decryptKeyBindingSecret } from "@/server/services/key-binding-service";
import {
  createImageTask,
  getImageTaskConcurrencyState,
  markImageTaskFailed,
  markImageTaskRunning,
  markImageTaskSucceeded
} from "@/server/services/image-task-service";
import {
  generateImageWithSub2API,
  Sub2APIError
} from "@/server/services/sub2api-client";
import { getEffectiveImageLimits } from "@/server/services/runtime-settings-service";
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

  const limits = getEffectiveImageLimits(binding.limits);

  if (parsed.data.n > limits.max_n) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: `数量不能超过 ${limits.max_n}`,
      field: "n",
      requestId
    });
  }

  if (parsed.data.moderation === "low" && !limits.allow_moderation_low) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: "当前配置不允许 moderation=low",
      field: "moderation",
      requestId
    });
  }

  const sizeTier = validateSizeTier(parsed.data.size, limits.max_size_tier);

  if (!sizeTier.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: sizeTier.message,
      field: sizeTier.field,
      requestId
    });
  }

  const concurrency = getImageTaskConcurrencyState(session.user_id);

  if (concurrency.limited) {
    return jsonError({
      status: 429,
      code: "rate_limited",
      message: "当前有图片任务正在运行，请等待完成或取消后重试。",
      requestId
    });
  }

  const startedAt = Date.now();
  const task = createImageTask({
    userId: session.user_id,
    keyBindingId: binding.id,
    type: "generation",
    prompt: parsed.data.prompt,
    params: parsed.data
  });
  markImageTaskRunning(task.id);

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
          taskId: task.id,
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
    const durationMs = Date.now() - startedAt;
    markImageTaskSucceeded(task.id, {
      images,
      usage: upstream.usage,
      durationMs,
      upstreamRequestId: upstream.upstreamRequestId
    });
    await recordAuditLog({
      actorUserId: session.user_id,
      action: "image_generation.succeeded",
      targetType: "image_task",
      targetId: task.id,
      requestId,
      metadata: {
        upstream_request_id: upstream.upstreamRequestId,
        image_count: images.length,
        usage: upstream.usage
      }
    });

    return jsonOk(
      {
        task_id: task.id,
        images,
        usage: upstream.usage,
        duration_ms: durationMs
      },
      requestId,
      {
        upstreamRequestId: upstream.upstreamRequestId
      }
    );
  } catch (error) {
    if (error instanceof Sub2APIError) {
      markImageTaskFailed(task.id, {
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
        upstreamRequestId: error.upstreamRequestId
      });
      await recordAuditLog({
        actorUserId: session.user_id,
        action: "image_generation.failed",
        targetType: "image_task",
        targetId: task.id,
        requestId,
        metadata: {
          upstream_request_id: error.upstreamRequestId,
          code: error.code,
          message: error.message
        }
      });

      return jsonError({
        status: error.status,
        code: error.code,
        message: error.message,
        requestId,
        upstreamRequestId: error.upstreamRequestId
      });
    }

    markImageTaskFailed(task.id, {
      code: "upstream_error",
      message: "图片生成失败",
      durationMs: Date.now() - startedAt
    });
    await recordAuditLog({
      actorUserId: session.user_id,
      action: "image_generation.failed",
      targetType: "image_task",
      targetId: task.id,
      requestId,
      metadata: {
        code: "upstream_error",
        message: "图片生成失败"
      }
    });

    return jsonError({
      status: 502,
      code: "upstream_error",
      message: "图片生成失败",
      requestId
    });
  }
}
