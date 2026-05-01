import {
  parseGenerationParams,
  type ImageGenerationParams
} from "@/lib/validation/image-params";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getKeyBinding, getSession } from "@/server/services/dev-store";
import {
  createImageBatchForUser,
  scheduleImageBatchProcessing
} from "@/server/services/image-batch-service";
import { decryptKeyBindingSecret } from "@/server/services/key-binding-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function POST(request: Request) {
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

  const parsed = parseCreateBatchBody(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  const batch = createImageBatchForUser(session.user_id, {
    keyBindingId: binding.id,
    items: parsed.data
  });
  scheduleImageBatchProcessing(batch.batch_id, session.user_id, {
    baseUrl: binding.sub2api_base_url,
    apiKey: decryptKeyBindingSecret(binding)
  });

  return jsonOk(batch, requestId);
}

function parseCreateBatchBody(value: unknown):
  | {
      success: true;
      data: Array<{
        prompt: string;
        params: ImageGenerationParams;
      }>;
    }
  | { success: false; message: string; field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, message: "请求体必须是对象", field: "body" };
  }

  const input = value as Record<string, unknown>;
  const rawItems = typeof input.csv === "string" ? parseCsv(input.csv) : expandPromptSizes(input);

  if (!rawItems.success) {
    return rawItems;
  }

  if (rawItems.data.length === 0 || rawItems.data.length > 50) {
    return {
      success: false,
      message: "批量任务数量必须是 1-50 条",
      field: "items"
    };
  }

  const params = input.params && typeof input.params === "object" ? input.params : {};
  const parsedItems = rawItems.data.map((item) => {
    const parsed = parseGenerationParams({
      ...params,
      prompt: item.prompt,
      size: item.size,
      n: 1
    });

    if (!parsed.success) {
      return {
        success: false as const,
        message: parsed.error.message,
        field: parsed.error.details.field
      };
    }

    return {
      success: true as const,
      data: {
        prompt: item.prompt,
        params: parsed.data
      }
    };
  });
  const failed = parsedItems.find((item) => !item.success);

  if (failed && !failed.success) {
    return failed;
  }

  return {
    success: true,
    data: parsedItems
      .filter((item) => item.success)
      .map((item) => item.data)
  };
}

function expandPromptSizes(input: Record<string, unknown>) {
  if (
    !Array.isArray(input.prompts) ||
    input.prompts.some((prompt) => typeof prompt !== "string")
  ) {
    return { success: false as const, message: "prompts 必须是字符串数组", field: "prompts" };
  }

  if (
    !Array.isArray(input.sizes) ||
    input.sizes.some((size) => typeof size !== "string")
  ) {
    return { success: false as const, message: "sizes 必须是字符串数组", field: "sizes" };
  }

  const prompts = input.prompts.map((prompt) => prompt.trim()).filter(Boolean);
  const sizes = input.sizes.map((size) => size.trim()).filter(Boolean);

  return {
    success: true as const,
    data: prompts.flatMap((prompt) => sizes.map((size) => ({ prompt, size })))
  };
}

function parseCsv(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const header = lines.shift()?.split(",").map((column) => column.trim()) ?? [];
  const promptIndex = header.indexOf("prompt");
  const sizeIndex = header.indexOf("size");

  if (promptIndex < 0 || sizeIndex < 0) {
    return {
      success: false as const,
      message: "CSV 必须包含 prompt 和 size 表头",
      field: "csv"
    };
  }

  return {
    success: true as const,
    data: lines
      .map((line) => line.split(","))
      .map((columns) => ({
        prompt: columns[promptIndex]?.trim() ?? "",
        size: columns[sizeIndex]?.trim() ?? ""
      }))
      .filter((item) => item.prompt && item.size)
  };
}
