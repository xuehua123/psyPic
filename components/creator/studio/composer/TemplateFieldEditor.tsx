"use client";

/**
 * TemplateFieldEditor —— 单个模板字段的渲染器（plan slug
 * quiet-glittering-prism · Cut 9）。
 *
 * 按 field.type 分发到不同子组件，统一对外暴露 `value` / `onChange`
 * 的受控接口。本组件只负责单字段；多字段编排（primary / advanced
 * 分区、grid 布局）由父级负责。
 *
 * 7 类 + constant：
 * - text          shadcn Input
 * - select        shadcn Select
 * - segmented     类 .segmented 风格 button group（≤ 4 项时优于 select）
 * - multi-select  chip 列表，点击切换 in/out
 * - slider        shadcn Slider + 当前值显示
 * - boolean       shadcn Checkbox + label
 * - color         原生 input type="color" + 文本值显示
 * - constant      不渲染 UI（返回 null）
 *
 * 父级负责把 fieldValues[field.key] 传入 value，以及在 onChange 时把新值
 * 写回 fieldValues。空数组 / 空字符串等默认值由 createTemplateFieldValues 处理。
 */

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { CommercialTemplateField } from "@/lib/templates/commercial-templates";
import { cn } from "@/lib/utils";

export type TemplateFieldEditorProps = {
  field: CommercialTemplateField;
  value: string | boolean | string[] | number | undefined;
  onChange: (next: string | boolean | string[] | number) => void;
};

export default function TemplateFieldEditor({
  field,
  value,
  onChange
}: TemplateFieldEditorProps) {
  // constant：UI 完全不渲染（plan 设计的"写死字段"）
  if (field.type === "constant") {
    return null;
  }

  const fieldId = `tplfield-${field.key}`;

  return (
    <div
      className="template-field"
      data-field-key={field.key}
      data-field-type={field.type}
      data-testid={`template-field-${field.key}`}
    >
      <div className="template-field-label-row">
        <Label htmlFor={fieldId}>
          {field.label}
          {field.required ? (
            <span className="template-field-required" aria-hidden="true">
              {" *"}
            </span>
          ) : null}
        </Label>
        {field.hint ? (
          <span className="template-field-hint">{field.hint}</span>
        ) : null}
      </div>

      <div className="template-field-control">
        {renderControl(field, value, onChange, fieldId)}
      </div>
    </div>
  );
}

function renderControl(
  field: CommercialTemplateField,
  value: TemplateFieldEditorProps["value"],
  onChange: TemplateFieldEditorProps["onChange"],
  fieldId: string
) {
  switch (field.type) {
    case "text":
      return (
        <Input
          data-testid={`template-field-${field.key}-input`}
          id={fieldId}
          onChange={(event) => onChange(event.target.value)}
          placeholder={asString(field.defaultValue)}
          value={asString(value)}
        />
      );

    case "color":
      return (
        <div className="template-field-color">
          <input
            aria-label={field.label}
            className="template-field-color-swatch"
            data-testid={`template-field-${field.key}-color`}
            id={fieldId}
            onChange={(event) => onChange(event.target.value)}
            type="color"
            value={asString(value) || "#888888"}
          />
          <Input
            aria-label={`${field.label} hex`}
            data-testid={`template-field-${field.key}-color-text`}
            onChange={(event) => onChange(event.target.value)}
            placeholder="#RRGGBB"
            value={asString(value)}
          />
        </div>
      );

    case "boolean": {
      const checked = typeof value === "boolean" ? value : false;
      return (
        <label className="template-field-toggle" htmlFor={fieldId}>
          <Checkbox
            aria-label={field.label}
            checked={checked}
            data-testid={`template-field-${field.key}-checkbox`}
            id={fieldId}
            onCheckedChange={(next) => onChange(next === true)}
          />
          <span>{checked ? "是" : "否"}</span>
        </label>
      );
    }

    case "select": {
      const options = field.options ?? [];
      return (
        <Select
          onValueChange={(next) => onChange(next)}
          value={asString(value)}
        >
          <SelectTrigger
            data-testid={`template-field-${field.key}-select`}
            id={fieldId}
          >
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "segmented": {
      const options = field.options ?? [];
      const current = asString(value);
      return (
        <div
          className="template-field-segmented"
          data-testid={`template-field-${field.key}-segmented`}
          role="radiogroup"
        >
          {options.map((option) => {
            const active = option === current;
            return (
              <button
                aria-checked={active}
                aria-label={option}
                className={cn(
                  "template-field-segment",
                  active ? "template-field-segment-active" : undefined
                )}
                data-testid={`template-field-${field.key}-segment-${option}`}
                key={option}
                onClick={() => onChange(option)}
                role="radio"
                type="button"
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    case "multi-select": {
      const options = field.options ?? [];
      const selected = Array.isArray(value) ? value : [];
      return (
        <div
          className="template-field-multiselect"
          data-testid={`template-field-${field.key}-multiselect`}
        >
          {options.map((option) => {
            const isOn = selected.includes(option);
            return (
              <button
                aria-label={`切换 ${option}`}
                aria-pressed={isOn}
                className={cn(
                  "template-field-chip",
                  isOn ? "template-field-chip-active" : undefined
                )}
                data-testid={`template-field-${field.key}-chip-${option}`}
                key={option}
                onClick={() =>
                  onChange(
                    isOn
                      ? selected.filter((item) => item !== option)
                      : [...selected, option]
                  )
                }
                type="button"
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    case "slider": {
      const range = field.range ?? { min: 0, max: 10, step: 1 };
      const numeric = typeof value === "number" ? value : range.min;
      return (
        <div className="template-field-slider">
          <Slider
            aria-label={field.label}
            data-testid={`template-field-${field.key}-slider`}
            max={range.max}
            min={range.min}
            onValueChange={(values) => onChange(values[0] ?? range.min)}
            step={range.step}
            value={[numeric]}
          />
          <span
            aria-hidden="true"
            className="template-field-slider-value"
            data-testid={`template-field-${field.key}-slider-value`}
          >
            {numeric}
          </span>
        </div>
      );
    }

    default:
      return null;
  }
}

function asString(value: TemplateFieldEditorProps["value"]): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}
