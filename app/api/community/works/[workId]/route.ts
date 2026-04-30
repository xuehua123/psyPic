import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import { getCommunityWorkForViewer } from "@/server/services/community-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ workId: string }> }
) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;
  const { workId } = await context.params;
  const work = getCommunityWorkForViewer(workId, session?.user_id ?? null);

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
