import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { resolveAdminUser } from "@/server/services/admin-auth-service";
import { recordAuditLog } from "@/server/services/audit-log-service";
import { restoreCommunityWork } from "@/server/services/community-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ workId: string }> }
) {
  const requestId = createRequestId();
  const admin = resolveAdminUser(request);

  if (admin.status !== "ok") {
    return adminError(admin.status, requestId);
  }

  const body = await request.json().catch(() => ({}));
  const reason =
    body && typeof body === "object" && "reason" in body
      ? String((body as Record<string, unknown>).reason ?? "").trim()
      : "";
  const { workId } = await context.params;
  const work = restoreCommunityWork(workId, {
    reviewerUserId: admin.user.id,
    reason
  });

  if (!work) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "作品不存在",
      requestId
    });
  }

  recordAuditLog({
    actorUserId: admin.user.id,
    action: "community_work.restore",
    targetType: "community_work",
    targetId: workId,
    requestId,
    metadata: { reason }
  });

  return jsonOk(work, requestId);
}

function adminError(status: "unauthorized" | "forbidden", requestId: string) {
  return jsonError({
    status: status === "unauthorized" ? 401 : 403,
    code: status,
    message: status === "unauthorized" ? "请先登录管理员账号" : "需要管理员权限",
    requestId
  });
}
