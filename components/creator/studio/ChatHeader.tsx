"use client";

import {
  Menu,
  MessageSquare,
  MessageSquareOff,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen
} from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 中栏对话工作区的顶部 header：当前对话标题 + 工具按钮（含 Board
 * 入口与分叉提示 pill）。
 *
 * 来自原 CreatorWorkspace.tsx L1680-1693（4116 行单文件巨兽拆分计划
 * 的第四刀）。Board 按钮 onClick 滚动到 Inspector 中的 BranchMapSection
 * (`data-testid="branch-map"`)，让用户从中栏一键跳到分支图。
 *
 * Plan Task 6 移动端：左侧加 Menu 汉堡按钮（md:hidden 仅在移动端显示），
 * onOpenMobileSidebar 由父级 CreatorWorkspace 提供，用 shadcn Sheet 把
 * ProjectSidebar 弹成左抽屉。桌面端 sidebar 一直可见，不需要 Menu 按钮。
 */
type ChatHeaderProps = {
  conversationTitle: string;
  forkParentId: string | null;
  onOpenMobileSidebar?: () => void;
  // 桌面端侧边栏与输入框折叠控制
  leftSidebarCollapsed?: boolean;
  onToggleLeftSidebar?: () => void;
  rightSidebarCollapsed?: boolean;
  onToggleRightSidebar?: () => void;
  composerCollapsed?: boolean;
  onToggleComposer?: () => void;
};

export default function ChatHeader({
  conversationTitle,
  forkParentId,
  onOpenMobileSidebar,
  leftSidebarCollapsed = false,
  onToggleLeftSidebar,
  rightSidebarCollapsed = false,
  onToggleRightSidebar,
  composerCollapsed = false,
  onToggleComposer
}: ChatHeaderProps) {
  return (
    <header className="chat-workspace-header">
      <div className="flex min-w-0 items-center gap-2">
        {onOpenMobileSidebar ? (
          <Button
            aria-label="打开项目侧边栏"
            className="md:hidden size-8 shrink-0"
            onClick={onOpenMobileSidebar}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Menu aria-hidden size={18} />
          </Button>
        ) : null}

        {/* 桌面端折叠左栏按钮 */}
        {onToggleLeftSidebar && (
          <Button
            aria-label={leftSidebarCollapsed ? "展开项目栏" : "折叠项目栏"}
            className="workspace-collapse-button size-8 shrink-0 hover:bg-muted"
            onClick={onToggleLeftSidebar}
            size="icon"
            type="button"
            variant="ghost"
          >
            {leftSidebarCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </Button>
        )}

        <div className="min-w-0 ml-1">
          <span className="sidebar-section-title">当前对话</span>
          <h1>{conversationTitle}</h1>
        </div>
      </div>
      <div className="chat-header-actions">
        {forkParentId ? (
          <span className="version-context-pill">分叉生成中</span>
        ) : null}

        {/* 输入框折叠控制按钮 */}
        {onToggleComposer && (
          <Button
            aria-label={composerCollapsed ? "显示输入框" : "隐藏输入框"}
            className="size-8 p-0"
            onClick={onToggleComposer}
            type="button"
            variant="ghost"
            title={composerCollapsed ? "显示输入框" : "隐藏输入框"}
          >
            {composerCollapsed ? (
              <MessageSquare size={16} />
            ) : (
              <MessageSquareOff size={16} />
            )}
          </Button>
        )}

        {/* 桌面端折叠右栏按钮 */}
        {onToggleRightSidebar && (
          <Button
            aria-label={rightSidebarCollapsed ? "展开参数栏" : "折叠参数栏"}
            className="workspace-collapse-button size-8 p-0"
            onClick={onToggleRightSidebar}
            type="button"
            variant="ghost"
            title={rightSidebarCollapsed ? "展开参数栏" : "折叠参数栏"}
          >
            {rightSidebarCollapsed ? (
              <PanelRightOpen size={16} />
            ) : (
              <PanelRightClose size={16} />
            )}
          </Button>
        )}

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
