"use client";

/**
 * ParamsSection —— Inspector 第一个 section "生成参数"，包含 mode 切换、
 * 商业尺寸预设、size 下拉、quality 三段、outputFormat 下拉、n 数量、
 * 流式预览开关 + partialImageCount 派生显示、高级参数折叠（compression
 * + moderation）。
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx 原 L1571-1763 的
 * inspector-section #1（UI 重构 Phase 4 第 15 刀-B）。
 *
 * 数据来源: 全部走 useCreatorStudio() —— 第 15 刀-A 扩 16 字段，本组件
 * 首发消费完整 read+write 集合（mode/size/quality/n/format/streamEnabled
 * + 6 个 setter + advanced 区块 8 字段 + selectedCommercialSizeId +
 * selectCommercialSize）。
 *
 * qualityOptions inline 一份；主壳 legacy 段也用同一份常量，等第 20 刀
 * 抽 legacy 时一并清理重复。
 */

import { SlidersHorizontal } from "lucide-react";

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
import { commercialSizePresets } from "@/lib/templates/commercial-size-presets";
import {
  GENERATION_SIZE_OPTIONS,
  type ImageGenerationParams
} from "@/lib/validation/image-params";

const qualityOptions = [
  { label: "自动", value: "auto" },
  { label: "标准", value: "medium" },
  { label: "高质", value: "high" }
] as const;

export default function ParamsSection() {
  const {
    mode,
    setMode,
    size,
    setSize,
    quality,
    setQuality,
    outputFormat,
    setOutputFormat,
    n,
    setN,
    streamEnabled,
    setStreamEnabled,
    partialImageCount,
    setPartialImageCount,
    advancedOpen,
    setAdvancedOpen,
    outputCompression,
    setOutputCompression,
    moderation,
    setModeration,
    selectedCommercialSizeId,
    selectCommercialSize
  } = useCreatorStudio();

  return (
    <section className="inspector-section">
      <SectionHeading icon={SlidersHorizontal} title="生成参数" />
      <div className="field-stack">
        <div className="field">
          <div className="field-label">模式</div>
          <div className="segmented">
            <button
              className={`segment ${mode === "text" ? "active" : ""}`}
              onClick={() => setMode("text")}
              type="button"
            >
              文生图
            </button>
            <button
              className={`segment ${mode === "image" ? "active" : ""}`}
              onClick={() => setMode("image")}
              type="button"
            >
              图生图
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="model">模型</label>
          <Select defaultValue="gpt-image-2">
            <SelectTrigger id="model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-image-2">gpt-image-2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="field">
          <label htmlFor="commercial-size">商业尺寸</label>
          <Select
            onValueChange={selectCommercialSize}
            value={selectedCommercialSizeId}
          >
            <SelectTrigger id="commercial-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {commercialSizePresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label} · {preset.size}
                </SelectItem>
              ))}
              <SelectItem value="custom">按尺寸选择</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="field">
          <label htmlFor="size">尺寸</label>
          <Select
            onValueChange={(value) =>
              setSize(value as ImageGenerationParams["size"])
            }
            value={size}
          >
            <SelectTrigger id="size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENERATION_SIZE_OPTIONS.map((sizeOption) => (
                <SelectItem key={sizeOption} value={sizeOption}>
                  {sizeOption === "auto" ? "自动" : sizeOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="field">
          <div className="field-label">质量</div>
          <div className="segmented three">
            {qualityOptions.map((option) => (
              <button
                className={`segment ${
                  option.value === quality ? "active" : ""
                }`}
                key={option.value}
                onClick={() => setQuality(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="output-format">输出格式</label>
          <Select
            onValueChange={(value) =>
              setOutputFormat(
                value as ImageGenerationParams["output_format"]
              )
            }
            value={outputFormat}
          >
            <SelectTrigger id="output-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="jpeg">JPEG</SelectItem>
              <SelectItem value="webp">WebP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="field">
          <label htmlFor="count">数量</label>
          <Input
            id="count"
            min={1}
            max={8}
            onChange={(event) => setN(Number(event.target.value))}
            type="number"
            value={n}
          />
        </div>

        <label className="toggle-row">
          <input
            aria-label="流式预览"
            checked={streamEnabled}
            onChange={(event) => setStreamEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>流式预览</span>
        </label>

        {streamEnabled ? (
          <div className="field">
            <label htmlFor="partial-images">Partial Images</label>
            <Select
              onValueChange={(value) => setPartialImageCount(Number(value))}
              value={String(partialImageCount)}
            >
              <SelectTrigger id="partial-images">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <Button
          aria-expanded={advancedOpen}
          variant="secondary"
          onClick={() => setAdvancedOpen((open) => !open)}
          type="button"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          高级参数
        </Button>

        {advancedOpen ? (
          <div className="field-stack">
            <div className="field">
              <label htmlFor="compression">Output Compression</label>
              <Input
                id="compression"
                max={100}
                min={1}
                onChange={(event) => setOutputCompression(event.target.value)}
                type="number"
                placeholder="仅 JPEG/WebP"
                value={outputCompression}
              />
            </div>
            <div className="field">
              <label htmlFor="moderation">Moderation</label>
              <Select
                onValueChange={(value) =>
                  setModeration(
                    value as ImageGenerationParams["moderation"]
                  )
                }
                value={moderation}
              >
                <SelectTrigger id="moderation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">auto</SelectItem>
                  <SelectItem value="low">low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
