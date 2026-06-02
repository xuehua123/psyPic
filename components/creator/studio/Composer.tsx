"use client";

/**
 * Composer —— 创作工作台中部"对话流下方"的 prompt 输入条。
 *
 * 结构（plan slug quiet-glittering-prism · Cut 10 升级）：
 * - QuickPickRow             顶部 chip 行（模板 / 比例 / 质量 / 风格 / 数量 / 格式 / 高级）
 * - composer-reference-row   已选参考图缩略图条 + 「再添加」按钮（仅有图时渲染）
 * - chat-prompt-input        textarea（autosize via field-sizing）
 * - composer-actions         hint + 上传 / 展开 / 优化 / 收藏 / 生成
 * - errorMessage             条件渲染
 *
 * Overlay：
 * - PromptExpandedDialog     长 prompt 全屏编辑（calm-squishing-globe Cut 4）
 * - TemplatePickerDialog     14 个商业模板 picker（quiet-glittering-prism Cut 7）
 * - AdvancedParamsDrawer     右侧高级参数 Sheet（quiet-glittering-prism Cut 8）
 *
 * 数据来源：全部走 useCreatorStudio()。
 *
 * 重大变化（quiet-glittering-prism · Cut 10）：
 * - 移除 composer-context-row（mode/size/quality/n/format/stream 显示）—— 高频
 *   参数全部上提到 QuickPickRow chip，低频参数收纳到右侧抽屉
 * - 移除 useCreatorStudio() 对 mode/size/quality/outputFormat/n/streamEnabled
 *   的消费（这些值的展示在 QuickPickRow 内部）
 */

import * as React from "react";
import { ImagePlus, Maximize2, Play, Sparkles, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import PromptExpandedDialog from "@/components/creator/studio/PromptExpandedDialog";
import QuickPickRow from "@/components/creator/studio/composer/QuickPickRow";
import TemplatePickerDialog from "@/components/creator/studio/composer/TemplatePickerDialog";
import AdvancedParamsDrawer from "@/components/creator/studio/composer/AdvancedParamsDrawer";

const MAX_REFERENCE_IMAGES = 8;

export default function Composer() {
  const {
    prompt,
    setPrompt,
    forkParentId,
    errorMessage,
    isAssistingPrompt,
    isGenerating,
    optimizePrompt,
    saveCurrentPromptFavorite,
    submitGeneration,
    referenceImages,
    referencePreviews,
    handleReferenceInput,
    handleReferenceDrop,
    handleReferencePaste,
    removeReferenceImage
  } = useCreatorStudio();

  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [expandedOpen, setExpandedOpen] = React.useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  /** 「添加图」按钮触发的 hidden file input。与缩略图条上的 add label 内
   *  input 共享 `handleReferenceInput`，但单独存在以便 actions 区按钮在
   *  0 张时也能作为常驻入口（chip 区在 0 张时不渲染缩略图）。 */
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (Array.from(event.dataTransfer.types).includes("Files")) {
      event.preventDefault();
      setIsDraggingOver(true);
    }
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    // 防止 drag enter 子节点时误触 leave —— relatedTarget 为 null 表示离开
    // 整个 composer 容器；在容器内部移动则 relatedTarget 是子节点，不清除
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingOver(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    setIsDraggingOver(false);
    handleReferenceDrop(event);
  }

  return (
    <div
      className="chat-composer"
      data-dragging={isDraggingOver ? "true" : undefined}
      data-testid="prompt-composer"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handleReferencePaste}
    >
      <div className="composer-inner">
        <QuickPickRow
          onOpenAdvanced={() => setAdvancedOpen(true)}
          onOpenTemplateChooser={() => setTemplatePickerOpen(true)}
        />
        {referenceImages.length > 0 ? (
          <div
            aria-label={`已选参考图 ${referenceImages.length} 张`}
            className="composer-reference-row"
            data-testid="composer-reference-row"
          >
            {referenceImages.map((image, index) => (
              <div
                className="composer-reference-chip"
                key={`${image.name}-${image.lastModified}-${index}`}
              >
                {referencePreviews[index] ? (
                  <img
                    alt={`参考图 ${image.name}`}
                    src={referencePreviews[index].url}
                  />
                ) : null}
                <button
                  aria-label={`移除参考图 ${image.name}`}
                  onClick={() => removeReferenceImage(index)}
                  type="button"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </div>
            ))}
            {referenceImages.length < MAX_REFERENCE_IMAGES ? (
              <label
                aria-label="再添加一张参考图"
                className="composer-reference-add"
                data-testid="composer-reference-add"
              >
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  multiple
                  onChange={handleReferenceInput}
                  type="file"
                />
                <ImagePlus size={14} aria-hidden="true" />
              </label>
            ) : null}
          </div>
        ) : null}
        <label className="sr-only" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          className="chat-prompt-input"
          id="prompt"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="描述商业图片，或拖 / 粘图作为参考图"
          value={prompt}
        />
        <div className="composer-actions">
          <span className="inline-hint">
            {forkParentId
              ? "当前上下文：独立分支。"
              : "默认不生成文字，不改变参考图主体。"}
          </span>
          <div className="prompt-action-buttons">
            <input
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              data-testid="composer-upload-input"
              multiple
              onChange={handleReferenceInput}
              ref={uploadInputRef}
              type="file"
            />
            <Button
              data-testid="composer-upload-trigger"
              disabled={
                referenceImages.length >= MAX_REFERENCE_IMAGES || isGenerating
              }
              onClick={() => uploadInputRef.current?.click()}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ImagePlus size={14} aria-hidden="true" />
              {referenceImages.length >= MAX_REFERENCE_IMAGES
                ? "已达 8 张上限"
                : "添加图"}
            </Button>
            <Button
              aria-label="展开编辑器"
              data-testid="composer-expand-trigger"
              onClick={() => setExpandedOpen(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Maximize2 size={14} aria-hidden="true" />
              展开
            </Button>
            <Button
              aria-label={isAssistingPrompt ? "优化中" : "优化 Prompt"}
              variant="secondary"
              disabled={isAssistingPrompt || isGenerating}
              onClick={optimizePrompt}
              size="sm"
              type="button"
            >
              <Sparkles size={16} aria-hidden="true" />
              {isAssistingPrompt ? "优化中" : "优化"}
            </Button>
            <Button
              aria-label="收藏 Prompt"
              variant="secondary"
              disabled={isGenerating}
              onClick={() => void saveCurrentPromptFavorite()}
              size="sm"
              type="button"
            >
              <Star size={16} aria-hidden="true" />
              收藏
            </Button>
            <Button
              disabled={isGenerating}
              onClick={submitGeneration}
              size="sm"
              type="button"
            >
              <Play size={16} aria-hidden="true" />
              {isGenerating ? "生成中" : "生成图片"}
            </Button>
          </div>
        </div>
        {errorMessage ? (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
      <PromptExpandedDialog
        onOpenChange={setExpandedOpen}
        open={expandedOpen}
      />
      <TemplatePickerDialog
        onOpenChange={setTemplatePickerOpen}
        open={templatePickerOpen}
      />
      <AdvancedParamsDrawer
        onOpenChange={setAdvancedOpen}
        open={advancedOpen}
      />
    </div>
  );
}
