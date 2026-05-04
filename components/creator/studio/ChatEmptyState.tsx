"use client";

/**
 * 工作台对话流的空状态。
 *
 * 当 displayedVersionNodes 为空时由 ChatTranscript 渲染。
 *
 * 视觉历史：
 * - Phase 4 第一刀（4116 行单文件巨兽拆分）抽出时保留装饰画布
 *   `<div className="studio-empty-canvas">` 但 CSS 已经 `display: none`
 *   屏蔽该装饰，留下 dead JSX。
 * - Phase 5 第 4 刀：删 dead 装饰画布，改成 4 个常用模板快捷卡
 *   网格（来自 useCreatorStudio() 的 mvpTemplates 前 4 个），点击
 *   直接套模板，符合 spec 「让用户最快进入创作」要求。
 */

import SectionHeading from "@/components/creator/studio/SectionHeading";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import { Sparkles } from "lucide-react";

type ChatEmptyStateProps = {
  emptyTitle: string;
  emptyDescription: string;
};

export default function ChatEmptyState({
  emptyTitle,
  emptyDescription
}: ChatEmptyStateProps) {
  const { mvpTemplates, selectCommercialTemplate } = useCreatorStudio();
  const quickTemplates = mvpTemplates.slice(0, 4);

  return (
    <section className="chat-empty-state" data-testid="active-gallery">
      <div className="studio-empty-state-panel">
        <div className="studio-empty-state-copy">
          <span className="template-pill">新对话</span>
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
        {quickTemplates.length > 0 ? (
          <div className="studio-empty-templates" aria-label="常用模板快捷入口">
            <SectionHeading icon={Sparkles} title="从模板开始" />
            <div className="studio-empty-template-grid">
              {quickTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  className="studio-empty-template-card"
                  onClick={() => selectCommercialTemplate(tpl.id)}
                  type="button"
                >
                  <strong>{tpl.name}</strong>
                  <span className="studio-empty-template-desc">
                    {tpl.description}
                  </span>
                  <span className="template-pill">
                    {tpl.requiresImage ? "需参考图" : "文生图"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
