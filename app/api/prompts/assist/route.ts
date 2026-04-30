import {
  assistCommercialPrompt,
  type PromptAssistMode
} from "@/lib/prompts/prompt-assistant";
import { getCommercialTemplate } from "@/lib/templates/commercial-templates";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const parsed = parsePromptAssistRequest(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: parsed.status,
      code: parsed.code,
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  if (parsed.templateId && !getCommercialTemplate(parsed.templateId)) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "模板不存在",
      field: "template_id",
      requestId
    });
  }

  return jsonOk(
    assistCommercialPrompt({
      prompt: parsed.prompt,
      mode: parsed.mode,
      templateId: parsed.templateId
    }),
    requestId
  );
}

function parsePromptAssistRequest(input: unknown):
  | {
      success: true;
      prompt: string;
      mode: PromptAssistMode;
      templateId?: string;
    }
  | {
      success: false;
      status: number;
      code: string;
      message: string;
      field: string;
    } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalidRequest("请求体必须是对象", "body");
  }

  const record = input as Record<string, unknown>;

  if (typeof record.prompt !== "string" || !record.prompt.trim()) {
    return invalidRequest("Prompt 不能为空", "prompt");
  }

  const mode = record.mode ?? "text";

  if (mode !== "text" && mode !== "image") {
    return invalidRequest("mode 必须是 text 或 image", "mode");
  }

  if (
    record.template_id !== undefined &&
    typeof record.template_id !== "string"
  ) {
    return invalidRequest("template_id 必须是字符串", "template_id");
  }

  return {
    success: true,
    prompt: record.prompt.trim(),
    mode,
    templateId: record.template_id?.trim() || undefined
  };
}

function invalidRequest(message: string, field: string) {
  return {
    success: false as const,
    status: 400,
    code: "invalid_parameter",
    message,
    field
  };
}
