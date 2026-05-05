"use client";

/**
 * AdvancedParamsDrawer —— 右侧抽屉式高级参数面板（plan slug
 * quiet-glittering-prism · Cut 8）。
 *
 * 把所有低频生成参数从右 Inspector 收纳到 Sheet 抽屉中，触发器是
 * QuickPickRow 的「⚙」chip。包含 7 块字段：
 *
 * 1. 数量 n（1-10 滑块）
 * 2. 输出格式 + JPEG/WebP 压缩率（output_compression）
 * 3. 背景 background（auto / opaque / transparent —— transparent 仅
 *    在 PNG/WebP 下可用，否则 schema 会拒绝）
 * 4. 内容审核 moderation（auto / low）
 * 5. 流式预览 stream + partial_images（仅 stream=true 时显示）
 * 6. 输入保真度 input_fidelity（仅 mode === "image"）
 *
 * 与 ParamsSection 的差异：
 * - 视觉是右侧滑入抽屉而非常驻面板
 * - 字段顺序按"低频但仍重要" 排列；mode / size / quality / format 这种
 *   高频字段已迁到 QuickPickRow，本组件不重复
 */

import { Sliders } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import type { ImageGenerationParams } from "@/lib/validation/image-params";

export type AdvancedParamsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AdvancedParamsDrawer({
  open,
  onOpenChange
}: AdvancedParamsDrawerProps) {
  const {
    mode,
    n,
    setN,
    outputFormat,
    outputCompression,
    setOutputCompression,
    background,
    setBackground,
    moderation,
    setModeration,
    streamEnabled,
    setStreamEnabled,
    partialImageCount,
    setPartialImageCount,
    inputFidelity,
    setInputFidelity
  } = useCreatorStudio();

  const compressionDisabled = outputFormat === "png";
  const transparentInvalidForJpeg =
    background === "transparent" && outputFormat === "jpeg";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-md flex flex-col gap-0"
        data-testid="advanced-params-drawer"
        side="right"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sliders size={18} aria-hidden="true" />
            高级参数
          </SheetTitle>
          <SheetDescription>
            低频但重要的生成控制；常用参数请用 prompt 输入区上方的
            chip 直接切换。
          </SheetDescription>
        </SheetHeader>

        <div className="advanced-drawer-body">
          {/* 数量 n（slider 1-10） */}
          <section className="advanced-section">
            <div className="advanced-section-head">
              <span>生成数量</span>
              <span className="advanced-section-value">{n} 张</span>
            </div>
            <Slider
              aria-label="生成数量"
              data-testid="advanced-n-slider"
              max={10}
              min={1}
              onValueChange={(values) => setN(values[0] ?? 1)}
              step={1}
              value={[n]}
            />
            <p className="advanced-section-hint">
              OpenAI gpt-image-2 支持 1-10 张同次生成；越多越慢且按张计费
            </p>
          </section>

          {/* 输出格式压缩 */}
          <section className="advanced-section">
            <div className="advanced-section-head">
              <span>输出压缩 (output_compression)</span>
              <span className="advanced-section-value">
                {compressionDisabled ? "—" : outputCompression || "默认 100"}
              </span>
            </div>
            <Input
              aria-label="输出压缩 1-100"
              data-testid="advanced-compression-input"
              disabled={compressionDisabled}
              max={100}
              min={1}
              onChange={(event) => setOutputCompression(event.target.value)}
              placeholder={
                compressionDisabled ? "PNG 不需要" : "1-100，越高质量越好"
              }
              type="number"
              value={outputCompression}
            />
            <p className="advanced-section-hint">
              {compressionDisabled
                ? "PNG 无损不传压缩参数；切到 JPEG / WebP 才生效"
                : "1-100，仅 JPEG / WebP 生效"}
            </p>
          </section>

          {/* 背景 */}
          <section className="advanced-section">
            <div className="advanced-section-head">
              <span>背景</span>
            </div>
            <Select
              onValueChange={(value) =>
                setBackground(value as ImageGenerationParams["background"])
              }
              value={background}
            >
              <SelectTrigger data-testid="advanced-background-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">auto · 由模型决定</SelectItem>
                <SelectItem value="opaque">opaque · 不透明</SelectItem>
                <SelectItem value="transparent">
                  transparent · 透明（仅 PNG / WebP）
                </SelectItem>
              </SelectContent>
            </Select>
            {transparentInvalidForJpeg ? (
              <p
                className="advanced-section-error"
                data-testid="advanced-background-error"
                role="alert"
              >
                JPEG 不支持透明背景，请改用 PNG 或 WebP
              </p>
            ) : null}
          </section>

          {/* 输入保真度 —— 仅图生图 */}
          {mode === "image" ? (
            <section className="advanced-section">
              <div className="advanced-section-head">
                <span>输入保真度 (input_fidelity)</span>
              </div>
              <Select
                onValueChange={(value) =>
                  setInputFidelity(value as "high" | "low")
                }
                value={inputFidelity}
              >
                <SelectTrigger data-testid="advanced-input-fidelity-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">low · 默认，自由编辑</SelectItem>
                  <SelectItem value="high">
                    high · 强保留人脸 / 主体特征
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="advanced-section-hint">
                仅图生图 / 编辑请求生效；high 适合人像 / LOGO / 字符等需精确
                保留细节的场景
              </p>
            </section>
          ) : null}

          {/* 内容审核 */}
          <section className="advanced-section">
            <div className="advanced-section-head">
              <span>内容审核 (moderation)</span>
            </div>
            <Select
              onValueChange={(value) =>
                setModeration(value as ImageGenerationParams["moderation"])
              }
              value={moderation}
            >
              <SelectTrigger data-testid="advanced-moderation-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">auto · 标准过滤（推荐）</SelectItem>
                <SelectItem value="low">low · 较宽松过滤</SelectItem>
              </SelectContent>
            </Select>
          </section>

          {/* 流式预览 */}
          <section className="advanced-section">
            <label className="advanced-toggle-row">
              <Checkbox
                aria-label="流式预览"
                checked={streamEnabled}
                data-testid="advanced-stream-checkbox"
                onCheckedChange={(checked) => setStreamEnabled(checked === true)}
              />
              <span>启用流式预览</span>
            </label>
            {streamEnabled ? (
              <div className="advanced-section-nested">
                <div className="advanced-section-head">
                  <span>Partial Images</span>
                  <span className="advanced-section-value">
                    {partialImageCount} 帧
                  </span>
                </div>
                <Slider
                  aria-label="Partial Images"
                  data-testid="advanced-partial-slider"
                  max={3}
                  min={0}
                  onValueChange={(values) =>
                    setPartialImageCount(values[0] ?? 0)
                  }
                  step={1}
                  value={[partialImageCount]}
                />
                <p className="advanced-section-hint">
                  0-3 帧；越多预览越细，但增加 token 开销
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <div className="advanced-drawer-footer">
          <Button
            data-testid="advanced-close"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="secondary"
          >
            关闭
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
