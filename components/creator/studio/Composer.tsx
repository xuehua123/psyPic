"use client";

/**
 * Composer —— 创作工作台中部"对话流下方"的 prompt 输入条，包含：
 * - composer-context-row（生成参数只读视图: mode/size/quality/n/format/stream）
 * - chat-prompt-input textarea（prompt 双向绑定）
 * - composer-actions: 当前上下文 hint + 3 个按钮（优化 / 收藏 / 生成）
 * - errorMessage 错误展示（条件渲染）
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx 原 L1551-1613 的
 * chat-composer div（UI 重构 Phase 4 第 13 刀-B）。
 *
 * 数据来源: 全部走 useCreatorStudio() —— 第 10 刀建 Context，第 13
 * 刀-A 扩 14 字段，本组件首发消费扩展后的 Context。
 *
 * 直接 import: lucide icon (Sparkles / Star / Play)
 */

import { Play, Sparkles, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";

export default function Composer() {
  const {
    prompt,
    setPrompt,
    mode,
    size,
    quality,
    outputFormat,
    n,
    streamEnabled,
    forkParentId,
    errorMessage,
    isAssistingPrompt,
    isGenerating,
    optimizePrompt,
    saveCurrentPromptFavorite,
    submitGeneration
  } = useCreatorStudio();

  return (
    <div className="chat-composer" data-testid="prompt-composer">
      <div className="composer-inner">
        <div className="composer-context-row">
          <span>{mode === "image" ? "图生图" : "文生图"}</span>
          <span>{size}</span>
          <span>{quality}</span>
          <span>{n} 张</span>
          <span>{outputFormat}</span>
          {streamEnabled ? <span>stream</span> : null}
        </div>
        <label className="sr-only" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          className="chat-prompt-input"
          id="prompt"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="描述你要生成的商业图片"
          value={prompt}
        />
        <div className="composer-actions">
          <span className="inline-hint">
            {forkParentId
              ? "当前上下文：独立分支。"
              : "默认不生成文字，不改变参考图主体。"}
          </span>
          <div className="prompt-action-buttons">
            <Button
              variant="secondary"
              disabled={isAssistingPrompt || isGenerating}
              onClick={optimizePrompt}
              type="button"
            >
              <Sparkles size={16} aria-hidden="true" />
              {isAssistingPrompt ? "优化中" : "优化 Prompt"}
            </Button>
            <Button
              variant="secondary"
              disabled={isGenerating}
              onClick={() => void saveCurrentPromptFavorite()}
              type="button"
            >
              <Star size={16} aria-hidden="true" />
              收藏 Prompt
            </Button>
            <Button
              disabled={isGenerating}
              onClick={submitGeneration}
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
    </div>
  );
}
