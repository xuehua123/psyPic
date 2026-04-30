import { parseGenerationParams } from "@/lib/validation/image-params";
import { validateReferenceImageUpload } from "@/lib/validation/upload";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getKeyBinding, getSession } from "@/server/services/dev-store";
import { decryptKeyBindingSecret } from "@/server/services/key-binding-service";
import {
  createImageTask,
  getImageTaskConcurrencyState,
  markImageTaskFailed,
  markImageTaskRunning,
  markImageTaskSucceeded
} from "@/server/services/image-task-service";
import { editImageWithSub2API, Sub2APIError } from "@/server/services/sub2api-client";
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

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: "请求必须是 multipart/form-data",
      field: "request",
      requestId
    });
  }

  const image = formData.get("image");

  if (!(image instanceof File)) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: "请上传一张参考图",
      field: "image",
      requestId
    });
  }

  const imageValidation = await validateReferenceImageUpload(image);

  if (!imageValidation.success) {
    return jsonError({
      status: imageValidation.error.code === "payload_too_large" ? 413 : 415,
      code: imageValidation.error.code,
      message: imageValidation.error.message,
      field: imageValidation.error.field,
      requestId
    });
  }

  const parsed = parseGenerationParams(formDataToParams(formData));

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
    type: "edit",
    prompt: parsed.data.prompt,
    params: parsed.data
  });
  markImageTaskRunning(task.id);

  try {
    const upstream = await editImageWithSub2API({
      baseUrl: binding.sub2api_base_url,
      apiKey: decryptKeyBindingSecret(binding),
      params: parsed.data,
      image: imageValidation.data.file
    });
    const images = await Promise.all(
      upstream.images.map(async (upstreamImage) => {
        const asset = await createTempAssetFromBase64({
          userId: session.user_id,
          taskId: task.id,
          b64Json: upstreamImage.b64_json,
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
      message: "图片编辑失败",
      durationMs: Date.now() - startedAt
    });

    return jsonError({
      status: 502,
      code: "upstream_error",
      message: "图片编辑失败",
      requestId
    });
  }
}

function formDataToParams(formData: FormData) {
  return {
    prompt: formData.get("prompt"),
    model: formData.get("model") ?? undefined,
    size: formData.get("size") ?? undefined,
    quality: formData.get("quality") ?? undefined,
    n: numberFromFormData(formData, "n"),
    output_format: formData.get("output_format") ?? undefined,
    output_compression: compressionFromFormData(formData),
    background: formData.get("background") ?? undefined,
    moderation: formData.get("moderation") ?? undefined
  };
}

function numberFromFormData(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return Number(value);
}

function compressionFromFormData(formData: FormData) {
  const value = formData.get("output_compression");

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return Number(value);
}
