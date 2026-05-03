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
      <div className="section-heading">
        <SlidersHorizontal size={15} aria-hidden="true" />
        <strong>生成参数</strong>
      </div>
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
          <select className="select" id="model" defaultValue="gpt-image-2">
            <option value="gpt-image-2">gpt-image-2</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="commercial-size">商业尺寸</label>
          <select
            className="select"
            id="commercial-size"
            onChange={(event) => selectCommercialSize(event.target.value)}
            value={selectedCommercialSizeId}
          >
            {commercialSizePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} · {preset.size}
              </option>
            ))}
            <option value="custom">按尺寸选择</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="size">尺寸</label>
          <select
            className="select"
            id="size"
            onChange={(event) =>
              setSize(event.target.value as ImageGenerationParams["size"])
            }
            value={size}
          >
            {GENERATION_SIZE_OPTIONS.map((sizeOption) => (
              <option key={sizeOption} value={sizeOption}>
                {sizeOption === "auto" ? "自动" : sizeOption}
              </option>
            ))}
          </select>
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
          <select
            className="select"
            id="output-format"
            onChange={(event) =>
              setOutputFormat(
                event.target.value as ImageGenerationParams["output_format"]
              )
            }
            value={outputFormat}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="count">数量</label>
          <input
            className="input"
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
            <select
              className="select"
              id="partial-images"
              onChange={(event) =>
                setPartialImageCount(Number(event.target.value))
              }
              value={partialImageCount}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
        ) : null}

        <button
          aria-expanded={advancedOpen}
          className="secondary-button"
          onClick={() => setAdvancedOpen((open) => !open)}
          type="button"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          高级参数
        </button>

        {advancedOpen ? (
          <div className="field-stack">
            <div className="field">
              <label htmlFor="compression">Output Compression</label>
              <input
                className="input"
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
              <select
                className="select"
                id="moderation"
                onChange={(event) =>
                  setModeration(
                    event.target.value as ImageGenerationParams["moderation"]
                  )
                }
                value={moderation}
              >
                <option value="auto">auto</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
