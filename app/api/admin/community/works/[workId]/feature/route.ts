import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { resolveAdminUser } from "@/server/services/admin-auth-service";
import { recordAuditLog } from "@/server/services/audit-log-service";
import { setCommunityWorkFeatured } from "@/server/services/community-service";

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
  const featured =
    body && typeof body === "object" && "featured" in body
      ? (body as Record<string, unknown>).featured
      : true;

  if (typeof featured !== "boolean") {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: "featured 必须是布尔值",
      field: "featured",
      requestId
    });
  }

  const { workId } = await context.params;
  const work = await setCommunityWorkFeatured(workId, {
    reviewerUserId: admin.user.id,
    featured
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
    action: featured ? "community_work.feature" : "community_work.unfeature",
    targetType: "community_work",
    targetId: workId,
    requestId,
    metadata: { featured }
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
