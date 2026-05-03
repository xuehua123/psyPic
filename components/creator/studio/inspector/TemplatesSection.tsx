"use client";

/**
 * TemplatesSection —— Inspector 第三个 section "商业模板"，包含：
 * - selectedTemplate 字段编辑器 + 应用模板按钮
 * - mvpTemplates 列表（每张卡显示 name / description / 是否需参考图）
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx 原 L1612-1657 的
 * commercial-template-list section（UI 重构 Phase 4 第 17 刀）。
 *
 * 数据来源: 全部走 useCreatorStudio() —— 第 17 刀扩 6 字段。
 * `renderTemplateField` 是本组件 owner —— 从主壳搬过来作为内部函数，
 * 因为它只在这个 section 内消费且只用 templateFieldValues +
 * updateTemplateFieldValue 两个 Context 字段。
 */

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import SectionHeading from "@/components/creator/studio/SectionHeading";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import type { CommercialTemplate } from "@/lib/templates/commercial-templates";

export default function TemplatesSection() {
  const {
    mvpTemplates,
    selectedTemplate,
    templateFieldValues,
    updateTemplateFieldValue,
    selectCommercialTemplate,
    applySelectedTemplate
  } = useCreatorStudio();

  function renderTemplateField(field: CommercialTemplate["fields"][number]) {
    const fieldId = `template-field-${field.key}`;
    const value = templateFieldValues[field.key] ?? field.defaultValue ?? "";

    if (field.type === "boolean") {
      return (
        <label className="checkbox-row template-checkbox-field" key={field.key}>
          <input
            aria-label={field.label}
            checked={Boolean(value)}
            onChange={(event) =>
              updateTemplateFieldValue(field.key, event.currentTarget.checked)
            }
            type="checkbox"
          />
          {field.label}
        </label>
      );
    }

    if (field.type === "select") {
      const optionValue = typeof value === "string" ? value : "";
      const options =
        field.options && field.options.length > 0 ? field.options : [optionValue];

      return (
        <div className="field template-field" key={field.key}>
          <label htmlFor={fieldId}>{field.label}</label>
          <Select
            onValueChange={(value) =>
              updateTemplateFieldValue(field.key, value)
            }
            value={optionValue}
          >
            <SelectTrigger aria-required={field.required} id={fieldId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="field template-field" key={field.key}>
        <label htmlFor={fieldId}>{field.label}</label>
        <Input
          aria-required={field.required}
          id={fieldId}
          onChange={(event) =>
            updateTemplateFieldValue(field.key, event.target.value)
          }
          type="text"
          value={typeof value === "string" ? value : ""}
        />
      </div>
    );
  }

  return (
    <section
      className="inspector-section"
      data-testid="commercial-template-list"
    >
      <SectionHeading icon={Sparkles} title="商业模板" />
      {selectedTemplate ? (
        <div className="template-field-editor" aria-label="模板字段">
          <div className="template-editor-header">
            <strong>{selectedTemplate.name}</strong>
            <span>{selectedTemplate.description}</span>
          </div>
          <div className="template-field-grid">
            {selectedTemplate.fields.map(renderTemplateField)}
          </div>
          <Button
            onClick={applySelectedTemplate}
            type="button"
          >
            <Sparkles size={16} aria-hidden="true" />
            应用模板
          </Button>
        </div>
      ) : null}
      <div className="template-list">
        {mvpTemplates.map((template) => (
          <button
            className="template-button"
            key={template.id}
            onClick={() => selectCommercialTemplate(template.id)}
            type="button"
          >
            <span>
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </span>
            <span className="template-pill">
              {template.requiresImage ? "需参考图" : "文生图"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
