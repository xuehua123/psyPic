"use client";

/**
 * QuickPickRow —— Composer 顶部参数 chip 行（plan slug
 * quiet-glittering-prism · Cut 6）。
 *
 * 把高频生成参数从右侧 Inspector 上提到 prompt 输入框上方，参考
 * ChatGPT Image / Midjourney / Claude.ai 的输入区交互习惯。每个 chip
 * 都是 DropdownMenu 触发器，展开后显示候选值。
 *
 * 8 个 chip（左→右）：
 * 1. + 模板    点开 TemplatePickerDialog（onOpenTemplateChooser）
 * 2. 比例     11 个商业 size preset 按 aspect 分组
 * 3. 质量     auto / low / medium / high
 * 4. 风格     8 个商业风格（photography / illustration / 3d / ...）
 * 5. 数量     1 / 2 / 4 / 6 / 8 / 10
 * 6. 格式     PNG / JPEG / WebP（低频，折叠）
 * 7. ⚙ 高级    点开 AdvancedParamsDrawer（onOpenAdvanced）
 *
 * 「+ 添加图」按钮已在 Composer.tsx 里实现（calm-squishing-globe Cut 5），
 * 本组件不重复。
 *
 * 数据来源：全部走 useCreatorStudio()。
 */

import * as React from "react";
import {
  ChevronDown,
  ImageIcon,
  Layers,
  Palette,
  RectangleHorizontal,
  Settings2,
  Sparkles
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  commercialSizePresets,
  groupSizePresetsByAspect,
  findSizePresetById,
  type CommercialSizeAspect
} from "@/lib/templates/commercial-size-presets";
import {
  STYLE_LABEL,
  STYLE_OPTIONS,
  type ImageGenerationParams
} from "@/lib/validation/image-params";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import { cn } from "@/lib/utils";

const QUALITY_OPTIONS: Array<{
  value: ImageGenerationParams["quality"];
  label: string;
  hint: string;
}> = [
  { value: "auto", label: "自动", hint: "由模型决定" },
  { value: "low", label: "草稿", hint: "速度优先 / 低成本" },
  { value: "medium", label: "标准", hint: "默认推荐" },
  { value: "high", label: "高质", hint: "成本翻倍" }
];

const N_OPTIONS = [1, 2, 4, 6, 8, 10] as const;

const FORMAT_OPTIONS: Array<{
  value: ImageGenerationParams["output_format"];
  label: string;
}> = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" }
];

const ASPECT_LABEL: Record<CommercialSizeAspect, string> = {
  "1:1": "方图 1:1",
  "16:9": "横版 16:9",
  "9:16": "竖版 9:16",
  auto: "智能"
};

export type QuickPickRowProps = {
  /** 点击「+ 模板」chip 触发 —— 父级负责打开 TemplatePickerDialog */
  onOpenTemplateChooser: () => void;
  /** 点击「⚙」chip 触发 —— 父级负责打开 AdvancedParamsDrawer */
  onOpenAdvanced: () => void;
};

export default function QuickPickRow({
  onOpenTemplateChooser,
  onOpenAdvanced
}: QuickPickRowProps) {
  const {
    mode,
    setMode,
    size,
    quality,
    setQuality,
    n,
    setN,
    outputFormat,
    setOutputFormat,
    style,
    setStyle,
    selectedTemplate,
    selectedCommercialSizeId,
    selectCommercialSize
  } = useCreatorStudio();

  const aspectGroups = React.useMemo(() => groupSizePresetsByAspect(), []);
  const currentSizePreset =
    findSizePresetById(selectedCommercialSizeId) ??
    commercialSizePresets.find((p) => p.size === size);
  const sizeChipLabel = currentSizePreset?.label ?? size;
  const sizeChipAspect = currentSizePreset?.aspect ?? "auto";

  const qualityLabel =
    QUALITY_OPTIONS.find((opt) => opt.value === quality)?.label ?? "标准";

  return (
    <div
      aria-label="生成参数快速切换"
      className="quickpick-row"
      data-testid="quickpick-row"
    >
      {/* mode segmented —— 文生图 / 图生图（plan slug
          quiet-glittering-prism · Cut 14 调整：保留显式切换以兼容
          ReferenceSection 的 mode-gated 渲染） */}
      <div
        aria-label="生成模式"
        className="segmented quickpick-mode"
      >
        <button
          aria-pressed={mode === "text"}
          className={`segment ${mode === "text" ? "active" : ""}`}
          onClick={() => setMode("text")}
          type="button"
        >
          文生图
        </button>
        <button
          aria-pressed={mode === "image"}
          className={`segment ${mode === "image" ? "active" : ""}`}
          onClick={() => setMode("image")}
          type="button"
        >
          图生图
        </button>
      </div>

      {/* + 模板 */}
      <button
        className={cn(
          "quickpick-chip",
          selectedTemplate ? "quickpick-chip-active" : undefined
        )}
        data-testid="quickpick-template-trigger"
        onClick={onOpenTemplateChooser}
        type="button"
      >
        <Layers size={14} aria-hidden="true" />
        <span>{selectedTemplate ? selectedTemplate.name : "+ 模板"}</span>
      </button>

      {/* 比例 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="quickpick-chip"
            data-testid="quickpick-size-trigger"
            type="button"
          >
            <RectangleHorizontal size={14} aria-hidden="true" />
            <span>{sizeChipLabel}</span>
            <span className="quickpick-chip-hint">
              {ASPECT_LABEL[sizeChipAspect]}
            </span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {(["1:1", "16:9", "9:16", "auto"] as CommercialSizeAspect[]).map(
            (aspect) => (
              <React.Fragment key={aspect}>
                <DropdownMenuLabel>{ASPECT_LABEL[aspect]}</DropdownMenuLabel>
                {aspectGroups[aspect].map((preset) => (
                  <DropdownMenuItem
                    data-testid={`quickpick-size-${preset.id}`}
                    key={preset.id}
                    onSelect={() => selectCommercialSize(preset.id)}
                  >
                    <span className="flex flex-1 items-center justify-between gap-3">
                      <span>{preset.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {preset.hint}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
                {aspect !== "auto" ? <DropdownMenuSeparator /> : null}
              </React.Fragment>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 质量 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="quickpick-chip"
            data-testid="quickpick-quality-trigger"
            type="button"
          >
            <Sparkles size={14} aria-hidden="true" />
            <span>质量 · {qualityLabel}</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuRadioGroup
            onValueChange={(value) =>
              setQuality(value as ImageGenerationParams["quality"])
            }
            value={quality}
          >
            {QUALITY_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem
                data-testid={`quickpick-quality-${opt.value}`}
                key={opt.value}
                value={opt.value}
              >
                <span className="flex flex-1 items-center justify-between gap-3">
                  <span>{opt.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {opt.hint}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 风格（plan slug quiet-glittering-prism · Cut 6）—— 解决用户"图片类型少"诉求 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="quickpick-chip"
            data-testid="quickpick-style-trigger"
            type="button"
          >
            <Palette size={14} aria-hidden="true" />
            <span>风格 · {STYLE_LABEL[style]}</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuRadioGroup
            onValueChange={(value) => setStyle(value as typeof style)}
            value={style}
          >
            {STYLE_OPTIONS.map((styleOpt) => (
              <DropdownMenuRadioItem
                data-testid={`quickpick-style-${styleOpt}`}
                key={styleOpt}
                value={styleOpt}
              >
                {STYLE_LABEL[styleOpt]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 数量 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="quickpick-chip"
            data-testid="quickpick-n-trigger"
            type="button"
          >
            <ImageIcon size={14} aria-hidden="true" />
            <span>{n} 张</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuRadioGroup
            onValueChange={(value) => setN(Number(value))}
            value={String(n)}
          >
            {N_OPTIONS.map((option) => (
              <DropdownMenuRadioItem
                data-testid={`quickpick-n-${option}`}
                key={option}
                value={String(option)}
              >
                {option} 张
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 格式 —— 低频参数；视觉收敛为最简 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="quickpick-chip quickpick-chip-secondary"
            data-testid="quickpick-format-trigger"
            type="button"
          >
            <span>{outputFormat.toUpperCase()}</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuRadioGroup
            onValueChange={(value) =>
              setOutputFormat(value as ImageGenerationParams["output_format"])
            }
            value={outputFormat}
          >
            {FORMAT_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem
                data-testid={`quickpick-format-${opt.value}`}
                key={opt.value}
                value={opt.value}
              >
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ⚙ 高级 —— 触发 AdvancedParamsDrawer */}
      <button
        aria-label="高级参数"
        className="quickpick-chip quickpick-chip-secondary"
        data-testid="quickpick-advanced-trigger"
        onClick={onOpenAdvanced}
        type="button"
        title="高级参数"
      >
        <Settings2 size={14} aria-hidden="true" />
      </button>

      {/* 注：「+ 添加图」入口在 composer-actions 区（已实现，calm-squishing-globe Cut 5），
              本组件不重复添加。 */}
    </div>
  );
}
