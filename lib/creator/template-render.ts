/**
 * 商业模板字段渲染辅助。
 */

import type { CommercialTemplate } from "@/lib/templates/commercial-templates";
import type { TemplateFieldValues } from "@/lib/creator/types";

export function createTemplateFieldValues(
  template: CommercialTemplate | undefined,
  seedText: string
): TemplateFieldValues {
  if (!template) {
    return {};
  }

  return Object.fromEntries(
    template.fields.map((field) => [
      field.key,
      field.defaultValue ?? (field.required ? seedText : "")
    ])
  ) as TemplateFieldValues;
}
