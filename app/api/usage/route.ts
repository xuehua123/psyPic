import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import { summarizeImageUsageForUser } from "@/server/services/image-task-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function GET(request: Request) {
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

  return jsonOk(await summarizeImageUsageForUser(session.user_id), requestId);
}
