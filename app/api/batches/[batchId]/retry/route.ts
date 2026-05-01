import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getKeyBinding, getSession } from "@/server/services/dev-store";
import {
  retryImageBatchItemsForUser,
  scheduleImageBatchProcessing
} from "@/server/services/image-batch-service";
import { decryptKeyBindingSecret } from "@/server/services/key-binding-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function POST(
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

  const binding = getKeyBinding(session.key_binding_id);

  if (!binding || binding.status !== "active") {
    return jsonError({
      status: 403,
      code: "forbidden",
      message: "当前 session 没有关联可用 key binding",
      requestId
    });
  }

  const parsed = parseRetryBody(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  const { batchId } = await context.params;
  const batch = retryImageBatchItemsForUser(batchId, session.user_id, {
    keyBindingId: binding.id,
    itemIds: parsed.data.itemIds
  });

  if (!batch) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "批量任务不存在",
      requestId
    });
  }
  scheduleImageBatchProcessing(batch.batch_id, session.user_id, {
    baseUrl: binding.sub2api_base_url,
    apiKey: decryptKeyBindingSecret(binding)
  });

  return jsonOk(batch, requestId);
}

function parseRetryBody(value: unknown):
  | { success: true; data: { itemIds: string[] } }
  | { success: false; message: string; field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, message: "请求体必须是对象", field: "body" };
  }

  const input = value as Record<string, unknown>;

  if (
    !Array.isArray(input.item_ids) ||
    input.item_ids.some((item) => typeof item !== "string")
  ) {
    return {
      success: false,
      message: "item_ids 必须是字符串数组",
      field: "item_ids"
    };
  }

  return {
    success: true,
    data: {
      itemIds: input.item_ids.map((item) => item.trim()).filter(Boolean)
    }
  };
}
