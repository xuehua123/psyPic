import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession, getUser } from "@/server/services/dev-store";
import { takeDownCommunityWork } from "@/server/services/community-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ workId: string }> }
) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;
  const user = session ? getUser(session.user_id) : null;

  if (!session || !user) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先登录管理员账号",
      requestId
    });
  }

  if (user.role !== "admin") {
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
  const work = takeDownCommunityWork(workId, {
    reviewerUserId: user.id,
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

  return jsonOk(work, requestId);
}
