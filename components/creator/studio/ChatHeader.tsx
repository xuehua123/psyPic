"use client";

import { Button } from "@/components/ui/button";

/**
 * 中栏对话工作区的顶部 header：当前对话标题 + 工具按钮（含 Board
 * 入口与分叉提示 pill）。
 *
 * 来自原 CreatorWorkspace.tsx L1680-1693（4116 行单文件巨兽拆分计划
 * 的第四刀）。Board 按钮 onClick 滚动到 Inspector 中的 BranchMapSection
 * (`data-testid="branch-map"`)，让用户从中栏一键跳到分支图。
 */
type ChatHeaderProps = {
  conversationTitle: string;
  forkParentId: string | null;
};

export default function ChatHeader({
  conversationTitle,
  forkParentId
}: ChatHeaderProps) {
  return (
    <header className="chat-workspace-header">
      <div>
        <span className="sidebar-section-title">当前对话</span>
        <h1>{conversationTitle}</h1>
      </div>
      <div className="chat-header-actions">
        {forkParentId ? (
          <span className="version-context-pill">分叉生成中</span>
        ) : null}
        <Button
          onClick={() => {
            const target = document.querySelector(
              '[data-testid="branch-map"]'
            );
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          type="button"
          variant="secondary"
        >
          Board
        </Button>
      </div>
    </header>
  );
}
