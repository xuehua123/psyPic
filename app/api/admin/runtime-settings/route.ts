import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { resolveAdminUser } from "@/server/services/admin-auth-service";
import { recordAuditLog } from "@/server/services/audit-log-service";
import {
  getRuntimeSettingsSnapshot,
  updateRuntimeSettings,
  type RuntimeSettings
} from "@/server/services/runtime-settings-service";

const sizeTiers = new Set(["2K", "4K"]);

export async function GET(request: Request) {
  const requestId = createRequestId();
  const admin = resolveAdminUser(request);

  if (admin.status !== "ok") {
    return adminError(admin.status, requestId);
  }

  return jsonOk(await getRuntimeSettingsSnapshot(), requestId);
}

export async function PATCH(request: Request) {
  const requestId = createRequestId();
  const admin = resolveAdminUser(request);

  if (admin.status !== "ok") {
    return adminError(admin.status, requestId);
  }

  const parsed = parseRuntimeSettingsBody(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  const snapshot = await updateRuntimeSettings(parsed.data, {
    updatedByUserId: admin.user.id
  });
  await recordAuditLog({
    actorUserId: admin.user.id,
    action: "runtime_settings.update",
    targetType: "runtime_settings",
    targetId: "global",
    requestId,
    metadata: { settings: snapshot.settings }
  });

  return jsonOk(snapshot, requestId);
}

function parseRuntimeSettingsBody(value: unknown):
  | { success: true; data: RuntimeSettings }
  | { success: false; message: string; field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, message: "请求体必须是对象", field: "body" };
  }

  const input = value as Record<string, unknown>;
  const maxN = parsePositiveInt(input.max_n, "max_n", 1, 8);
  if (!maxN.success) return maxN;
  const maxUploadMb = parsePositiveInt(
    input.max_upload_mb,
    "max_upload_mb",
    1,
    100
  );
  if (!maxUploadMb.success) return maxUploadMb;

  if (
    typeof input.max_size_tier !== "string" ||
    !sizeTiers.has(input.max_size_tier)
  ) {
    return {
      success: false,
      message: "max_size_tier 必须是 2K 或 4K",
      field: "max_size_tier"
    };
  }

  for (const field of [
    "allow_moderation_low",
    "community_enabled",
    "public_publish_enabled",
    "stream_enabled"
  ]) {
    if (typeof input[field] !== "boolean") {
      return {
        success: false,
        message: `${field} 必须是布尔值`,
        field
      };
    }
  }

  return {
    success: true,
    data: {
      max_n: maxN.data,
      max_upload_mb: maxUploadMb.data,
      max_size_tier: input.max_size_tier as RuntimeSettings["max_size_tier"],
      allow_moderation_low: input.allow_moderation_low as boolean,
      community_enabled: input.community_enabled as boolean,
      public_publish_enabled: input.public_publish_enabled as boolean,
      stream_enabled: input.stream_enabled as boolean
    }
  };
}

function parsePositiveInt(
  value: unknown,
  field: string,
  min: number,
  max: number
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    return {
      success: false as const,
      message: `${field} 必须是 ${min}-${max} 之间的整数`,
      field
    };
  }

  return { success: true as const, data: value };
}

function adminError(status: "unauthorized" | "forbidden", requestId: string) {
  return jsonError({
    status: status === "unauthorized" ? 401 : 403,
    code: status,
    message: status === "unauthorized" ? "请先登录管理员账号" : "需要管理员权限",
    requestId
  });
}
