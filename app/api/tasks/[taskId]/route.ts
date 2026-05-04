import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import {
  cancelImageTaskForUser,
  getImageTaskForUser,
  serializeImageTask
} from "@/server/services/image-task-service";
import { cancelImageJobForTask } from "@/server/services/image-job-queue-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const requestId = createRequestId();
  const session = readRequestSession(request);

  if (!session) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先导入或配置 Sub2API Key",
      requestId
    });
  }

  const { taskId } = await context.params;
  const task = await getImageTaskForUser(taskId, session.user_id);

  if (!task) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "任务不存在",
      requestId
    });
  }

  return jsonOk(serializeImageTask(task), requestId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const requestId = createRequestId();
  const session = readRequestSession(request);

  if (!session) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先导入或配置 Sub2API Key",
      requestId
    });
  }

  const { taskId } = await context.params;
  const task = await cancelImageTaskForUser(taskId, session.user_id);

  if (!task) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "任务不存在",
      requestId
    });
  }

  cancelImageJobForTask(task.id, session.user_id);

  return jsonOk(serializeImageTask(task), requestId);
}

function readRequestSession(request: Request) {
  const sessionId = readSessionIdFromRequest(request);

  return sessionId ? getSession(sessionId) : null;
}
