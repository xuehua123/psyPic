import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { resolveAdminUser } from "@/server/services/admin-auth-service";
import { listAuditLogs, recordAuditLog } from "@/server/services/audit-log-service";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const admin = resolveAdminUser(request);

  if (admin.status !== "ok") {
    return adminError(admin.status, requestId);
  }

  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const logs = await listAuditLogs({
    cursor: url.searchParams.get("cursor"),
    limit,
    action: url.searchParams.get("action")
  });

  return jsonOk(
    {
      items: logs.items,
      next_cursor: logs.nextCursor
    },
    requestId
  );
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const admin = resolveAdminUser(request);

  if (admin.status !== "ok") {
    return adminError(admin.status, requestId);
  }

  const parsed = parseAuditLogBody(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  const log = await recordAuditLog({
    actorUserId: admin.user.id,
    action: parsed.data.action,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    requestId,
    metadata: parsed.data.metadata
  });

  return jsonOk(log, requestId);
}

function parseAuditLogBody(value: unknown):
  | {
      success: true;
      data: {
        action: string;
        targetType: string;
        targetId: string;
        metadata: unknown;
      };
    }
  | { success: false; message: string; field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, message: "请求体必须是对象", field: "body" };
  }

  const input = value as Record<string, unknown>;
  const action = parseRequiredString(input.action, "action");
  if (!action.success) return action;
  const targetType = parseRequiredString(input.target_type, "target_type");
  if (!targetType.success) return targetType;
  const targetId = parseRequiredString(input.target_id, "target_id");
  if (!targetId.success) return targetId;

  return {
    success: true,
    data: {
      action: action.data,
      targetType: targetType.data,
      targetId: targetId.data,
      metadata: input.metadata ?? {}
    }
  };
}

function parseRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    return { success: false as const, message: `${field} 不能为空`, field };
  }

  return { success: true as const, data: value.trim() };
}

function adminError(status: "unauthorized" | "forbidden", requestId: string) {
  return jsonError({
    status: status === "unauthorized" ? 401 : 403,
    code: status,
    message: status === "unauthorized" ? "请先登录管理员账号" : "需要管理员权限",
    requestId
  });
}
