import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getKeyBinding, getSession } from "@/server/services/dev-store";
import {
  getImageBatchForUser,
  processImageBatchForUser
} from "@/server/services/image-batch-service";
import { decryptKeyBindingSecret } from "@/server/services/key-binding-service";
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
  let batch = getImageBatchForUser(batchId, session.user_id);

  if (!batch) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "批量任务不存在",
      requestId
    });
  }

  const binding = getKeyBinding(session.key_binding_id);

  if (!binding || binding.status !== "active") {
    return jsonError({
      status: 403,
      code: "forbidden",
      message: "当前 session 没有关联可用 key binding",
      requestId
    });
  }

  if (batch.status === "queued" || batch.status === "running") {
    batch =
      (await processImageBatchForUser(batchId, session.user_id, {
        baseUrl: binding.sub2api_base_url,
        apiKey: decryptKeyBindingSecret(binding),
        requestId
      })) ?? batch;
  }

  return jsonOk(batch, requestId);
}
