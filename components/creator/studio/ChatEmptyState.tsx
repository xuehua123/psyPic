"use client";

/**
 * 工作台对话流的空状态。
 *
 * 当 displayedVersionNodes 为空时渲染。本组件来自 CreatorWorkspace.tsx
 * L1698-1718（4116 行单文件巨兽拆分计划的第一刀）。
 *
 * 当前实现保留原视觉（含装饰画布 mockup），后续 commit 会按 plan
 * `linear-stirring-acorn` 改为「左对齐说明 + 模板快捷入口卡片网格」。
 */
type ChatEmptyStateProps = {
  emptyTitle: string;
  emptyDescription: string;
};

export default function ChatEmptyState({
  emptyTitle,
  emptyDescription
}: ChatEmptyStateProps) {
  return (
    <section className="chat-empty-state" data-testid="active-gallery">
      <div className="studio-empty-state-panel">
        <div className="studio-empty-state-copy">
          <span className="template-pill">新对话</span>
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
        <div className="studio-empty-canvas" aria-hidden="true">
          <div className="studio-empty-toolbar">
            <span />
            <span />
            <span />
          </div>
          <div className="studio-empty-grid">
            <span className="studio-empty-frame studio-empty-frame-main" />
            <span className="studio-empty-frame" />
            <span className="studio-empty-frame" />
          </div>
        </div>
      </div>
    </section>
  );
}
