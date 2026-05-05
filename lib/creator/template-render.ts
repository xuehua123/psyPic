/**
 * 商业模板字段渲染辅助（plan slug quiet-glittering-prism · Cut 3 升级）。
 *
 * 适配 7 种字段类型 + constant：
 * - text / select / segmented / color → string，default = field.defaultValue ?? (required ? seed : "")
 * - boolean → boolean，default = field.defaultValue ?? false
 * - multi-select → string[]，default = field.defaultValue ?? []
 * - slider → number，default = field.defaultValue ?? field.range?.min ?? 0
 * - constant → 不进 fieldValues（渲染层直接消费 field.constantValue）
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

  const entries: Array<[string, string | boolean | string[] | number]> = [];

  for (const field of template.fields) {
    if (field.type === "constant") {
      // constant 字段不进 fieldValues —— 渲染层直接读 field.constantValue
      continue;
    }

    if (field.type === "boolean") {
      const value = typeof field.defaultValue === "boolean"
        ? field.defaultValue
        : false;
      entries.push([field.key, value]);
      continue;
    }

    if (field.type === "multi-select") {
      const value = Array.isArray(field.defaultValue)
        ? [...field.defaultValue]
        : [];
      entries.push([field.key, value]);
      continue;
    }

    if (field.type === "slider") {
      const value = typeof field.defaultValue === "number"
        ? field.defaultValue
        : field.range?.min ?? 0;
      entries.push([field.key, value]);
      continue;
    }

    // text / select / segmented / color
    const stringDefault = typeof field.defaultValue === "string"
      ? field.defaultValue
      : "";
    const value = stringDefault || (field.required ? seedText : "");
    entries.push([field.key, value]);
  }

  return Object.fromEntries(entries) as TemplateFieldValues;
}
