import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { resolveAdminUser } from "@/server/services/admin-auth-service";
import { recordAuditLog } from "@/server/services/audit-log-service";
import { takeDownCommunityWork } from "@/server/services/community-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ workId: string }> }
) {
  const requestId = createRequestId();
  const admin = resolveAdminUser(request);

  if (admin.status === "unauthorized") {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先登录管理员账号",
      requestId
    });
  }

  if (admin.status === "forbidden") {
    return jsonError({
      status: 403,
      code: "forbidden",
      message: "需要管理员权限",
      requestId
    });
  }

  const body = await request.json().catch(() => ({}));
  const reason =
    body && typeof body === "object" && "reason" in body
      ? String((body as Record<string, unknown>).reason ?? "").trim()
      : "";
  const { workId } = await context.params;
  const work = await takeDownCommunityWork(workId, {
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

  await recordAuditLog({
    actorUserId: admin.user.id,
    action: "community_work.take_down",
    targetType: "community_work",
    targetId: workId,
    requestId,
    metadata: { reason }
  });

  return jsonOk(work, requestId);
}
