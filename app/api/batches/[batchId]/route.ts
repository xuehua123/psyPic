import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import { getImageBatchForUser } from "@/server/services/image-batch-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
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

  const { batchId } = await context.params;
  const batch = getImageBatchForUser(batchId, session.user_id);

  if (!batch) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "批量任务不存在",
      requestId
    });
  }

  return jsonOk(batch, requestId);
}
