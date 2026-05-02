import {
  parseGenerationParams,
  validateSizeTier
} from "@/lib/validation/image-params";
import {
  validateMaskImageUpload,
  validateReferenceImageUpload
} from "@/lib/validation/upload";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { recordAuditLog } from "@/server/services/audit-log-service";
import { getKeyBinding, getSession } from "@/server/services/dev-store";
import { decryptKeyBindingSecret } from "@/server/services/key-binding-service";
import {
  acquireImageTaskCreationLock,
  createImageTask,
  getImageTaskConcurrencyState,
  markImageTaskFailed,
  markImageTaskRunning,
  markImageTaskSucceeded
} from "@/server/services/image-task-service";
import { editImageWithSub2API, Sub2APIError } from "@/server/services/sub2api-client";
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

  const limits = await getEffectiveImageLimits(binding.limits);
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

  const images = formData.getAll("image");

  if (images.length === 0 || images.some((image) => !(image instanceof File))) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: "请至少上传一张参考图",
      field: "image",
      requestId
    });
  }

  if (images.length > 4) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: "最多支持 4 张参考图",
      field: "image",
      requestId
    });
  }

  const imageValidations = await Promise.all(
    (images as File[]).map((image) =>
      validateReferenceImageUpload(image, { maxUploadMb: limits.max_upload_mb })
    )
  );
  const failedImageValidation = imageValidations.find(
    (validation) => !validation.success
  );

  if (failedImageValidation && !failedImageValidation.success) {
    return jsonError({
      status: failedImageValidation.error.code === "payload_too_large" ? 413 : 415,
      code: failedImageValidation.error.code,
      message: failedImageValidation.error.message,
      field: failedImageValidation.error.field,
      requestId
    });
  }
  const validatedImages = imageValidations
    .filter((validation) => validation.success)
    .map((validation) => validation.data);

  const mask = formData.get("mask");
  let maskFile: File | undefined;

  if (mask !== null) {
    if (!(mask instanceof File)) {
      return jsonError({
        status: 400,
        code: "invalid_parameter",
        message: "遮罩必须是 PNG 图片文件",
        field: "mask",
        requestId
      });
    }

    const maskValidation = await validateMaskImageUpload(mask, {
      maxUploadMb: limits.max_upload_mb
    });

    if (!maskValidation.success) {
      return jsonError({
        status: maskValidation.error.code === "payload_too_large" ? 413 : 415,
        code: maskValidation.error.code,
        message: maskValidation.error.message,
        field: maskValidation.error.field,
        requestId
      });
    }

    if (!sameImageDimensions(validatedImages[0], maskValidation.data)) {
      return jsonError({
        status: 400,
        code: "invalid_parameter",
        message: "遮罩尺寸必须与参考图一致",
        field: "mask",
        requestId
      });
    }

    maskFile = maskValidation.data.file;
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

  const startedAt = Date.now();
  const releaseTaskCreation = await acquireImageTaskCreationLock(session.user_id);
  let task: Awaited<ReturnType<typeof createImageTask>>;

  try {
    const concurrency = await getImageTaskConcurrencyState(session.user_id);

    if (concurrency.limited) {
      return jsonError({
        status: 429,
        code: "rate_limited",
        message: "当前有图片任务正在运行，请等待完成或取消后重试。",
        requestId
      });
    }

    task = await createImageTask({
      userId: session.user_id,
      keyBindingId: binding.id,
      type: "edit",
      prompt: parsed.data.prompt,
      params: parsed.data
    });
    await markImageTaskRunning(task.id);
  } finally {
    releaseTaskCreation();
  }

  try {
    const upstream = await editImageWithSub2API({
      baseUrl: binding.sub2api_base_url,
      apiKey: decryptKeyBindingSecret(binding),
      params: parsed.data,
      images: validatedImages.map((image) => image.file),
      mask: maskFile
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
    await markImageTaskSucceeded(task.id, {
      images,
      usage: upstream.usage,
      durationMs,
      upstreamRequestId: upstream.upstreamRequestId
    });
    await recordAuditLog({
      actorUserId: session.user_id,
      action: "image_edit.succeeded",
      targetType: "image_task",
      targetId: task.id,
      requestId,
      metadata: {
        upstream_request_id: upstream.upstreamRequestId,
        image_count: images.length,
        reference_image_count: validatedImages.length,
        has_mask: Boolean(maskFile),
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
      await markImageTaskFailed(task.id, {
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
        upstreamRequestId: error.upstreamRequestId
      });
      await recordAuditLog({
        actorUserId: session.user_id,
        action: "image_edit.failed",
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

    await markImageTaskFailed(task.id, {
      code: "upstream_error",
      message: "图片编辑失败",
      durationMs: Date.now() - startedAt
    });
    await recordAuditLog({
      actorUserId: session.user_id,
      action: "image_edit.failed",
      targetType: "image_task",
      targetId: task.id,
      requestId,
      metadata: {
        code: "upstream_error",
        message: "图片编辑失败"
      }
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

function sameImageDimensions(
  image: { width?: number; height?: number },
  mask: { width?: number; height?: number }
) {
  if (
    image.width === undefined ||
    image.height === undefined ||
    mask.width === undefined ||
    mask.height === undefined
  ) {
    return true;
  }

  return image.width === mask.width && image.height === mask.height;
}
