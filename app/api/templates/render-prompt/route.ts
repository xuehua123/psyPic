import {
  getCommercialTemplate,
  renderCommercialPrompt
} from "@/lib/templates/commercial-templates";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";

type FieldValue = string | boolean | undefined;

export async function POST(request: Request) {
  const requestId = createRequestId();
  const input = await request.json().catch(() => null);
  const parsed = parseRenderPromptRequest(input);

  if (!parsed.success) {
    return jsonError({
      status: parsed.status,
      code: parsed.code,
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  const template = getCommercialTemplate(parsed.templateId);

  if (!template) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "模板不存在",
      field: "template_id",
      requestId
    });
  }

  const validatedFields = validateTemplateFields(template, parsed.fields);

  if (!validatedFields.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: validatedFields.message,
      field: validatedFields.field,
      requestId
    });
  }

  return jsonOk(
    renderCommercialPrompt(template.id, validatedFields.fields),
    requestId
  );
}

function parseRenderPromptRequest(input: unknown):
  | {
      success: true;
      templateId: string;
      fields: Record<string, FieldValue>;
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

  if (typeof record.template_id !== "string" || !record.template_id.trim()) {
    return invalidRequest("template_id 不能为空", "template_id");
  }

  if (
    !record.fields ||
    typeof record.fields !== "object" ||
    Array.isArray(record.fields)
  ) {
    return invalidRequest("fields 必须是对象", "fields");
  }

  const fields = record.fields as Record<string, unknown>;
  const normalizedFields: Record<string, FieldValue> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (
      value !== undefined &&
      typeof value !== "string" &&
      typeof value !== "boolean"
    ) {
      return invalidRequest(`${key} 必须是字符串或布尔值`, key);
    }

    normalizedFields[key] = value;
  }

  return {
    success: true,
    templateId: record.template_id.trim(),
    fields: normalizedFields
  };
}

function validateTemplateFields(
  template: NonNullable<ReturnType<typeof getCommercialTemplate>>,
  fields: Record<string, FieldValue>
):
  | { success: true; fields: Record<string, FieldValue> }
  | { success: false; field: string; message: string } {
  const validatedFields: Record<string, FieldValue> = {};

  for (const field of template.fields) {
    const value = fields[field.key];

    if (value !== undefined && typeof value !== expectedValueType(field.type)) {
      return {
        success: false,
        field: field.key,
        message:
          field.type === "boolean"
            ? `${field.label} 必须是布尔值`
            : `${field.label} 必须是字符串`
      };
    }

    if (
      field.required &&
      field.defaultValue === undefined &&
      (value === undefined ||
        (typeof value === "string" && value.trim().length === 0))
    ) {
      return {
        success: false,
        field: field.key,
        message: `${field.label} 不能为空`
      };
    }

    validatedFields[field.key] = value;
  }

  return { success: true, fields: validatedFields };
}

function expectedValueType(fieldType: string) {
  return fieldType === "boolean" ? "boolean" : "string";
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
