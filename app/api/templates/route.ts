import { commercialTemplates } from "@/lib/templates/commercial-templates";
import { createRequestId, jsonOk } from "@/server/services/api-response";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const url = new URL(request.url);
  const scene = url.searchParams.get("scene")?.trim();
  const cursor = url.searchParams.get("cursor")?.trim();
  const limit = clampTemplateLimit(
    Number.parseInt(url.searchParams.get("limit") ?? "", 10)
  );

  const templates = commercialTemplates.filter(
    (template) => !scene || template.scene === scene
  );
  const startIndex = cursor
    ? templates.findIndex((template) => template.id === cursor) + 1
    : 0;
  const safeStartIndex = Math.max(startIndex, 0);
  const page = templates.slice(safeStartIndex, safeStartIndex + limit);
  const hasNextPage = templates.length > safeStartIndex + page.length;

  return jsonOk(
    {
      items: page.map((template) => ({
        id: template.id,
        name: template.name,
        scene: template.scene,
        description: template.description,
        requires_image: template.requiresImage,
        requires_mask: Boolean(template.requiresMask),
        enabled_for_mvp: template.enabledForMvp,
        default_params: template.defaultParams,
        fields: template.fields.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          default_value: field.defaultValue
        }))
      })),
      next_cursor: hasNextPage ? page.at(-1)?.id ?? null : null
    },
    requestId
  );
}

function clampTemplateLimit(limit: number) {
  if (!Number.isInteger(limit)) {
    return 30;
  }

  return Math.min(Math.max(limit, 1), 50);
}
