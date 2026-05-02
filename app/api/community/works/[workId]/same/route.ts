import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import { createCommunitySameGenerationDraft } from "@/server/services/community-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ workId: string }> }
) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;
  const { workId } = await context.params;
  const result = await createCommunitySameGenerationDraft(
    workId,
    session?.user_id ?? null
  );

  if (result.status === "not_found") {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "作品不存在",
      requestId
    });
  }

  if (result.status === "disabled") {
    return jsonError({
      status: 403,
      code: "same_generation_disabled",
      message: "发布者未开放同款生成",
      requestId
    });
  }

  return jsonOk({ draft: result.draft }, requestId);
}
