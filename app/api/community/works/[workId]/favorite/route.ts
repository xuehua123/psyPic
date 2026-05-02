import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import { setCommunityWorkInteractionForUser } from "@/server/services/community-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ workId: string }> }
) {
  return updateFavorite(request, context, true);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ workId: string }> }
) {
  return updateFavorite(request, context, false);
}

async function updateFavorite(
  request: Request,
  context: { params: Promise<{ workId: string }> },
  enabled: boolean
) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先登录后再收藏作品",
      requestId
    });
  }

  const { workId } = await context.params;
  const work = await setCommunityWorkInteractionForUser(session.user_id, workId, {
    type: "favorite",
    enabled
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
