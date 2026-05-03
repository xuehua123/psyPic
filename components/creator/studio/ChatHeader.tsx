"use client";

import { Button } from "@/components/ui/button";

/**
 * 中栏对话工作区的顶部 header：当前对话标题 + 工具按钮（含 Board
 * 入口与分叉提示 pill）。
 *
 * 来自原 CreatorWorkspace.tsx L1680-1693（4116 行单文件巨兽拆分计划
 * 的第四刀）。当前实现保留原视觉与 className，后续 Phase 5/6 会再统一
 * 视觉 token / 替换 raw className 为 shadcn variant。
 *
 * Board 按钮目前没绑 onClick（原状），等版本图 / Branch Map 落地后再
 * 接入。
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
        <Button variant="secondary" type="button">
          Board
        </Button>
      </div>
    </header>
  );
}
