"use client";

import * as React from "react";
import {
  ArchiveIcon,
  CopyIcon,
  ExternalLinkIcon,
  FolderGit2,
  GitBranchIcon,
  Link2Icon,
  MailOpenIcon,
  MoreHorizontal,
  PanelTopIcon,
  PencilIcon,
  PinIcon
} from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/**
 * 会话级菜单：右键（桌面）+ 三点按钮（移动 / hover 兜底）。
 *
 * 11 项菜单，实做 4 项 / 占位 7 项：
 *   ✅ 复制会话 ID
 *   ✅ 复制深度链接
 *   ✅ 分叉到同一工作树（onForkSame）
 *   ✅ 派生到新工作树（onForkNew）
 *   占位 → onPlaceholder("xxx")：父级转 SidebarToast.show()
 *
 * onForkSame / onForkNew 是 optional —— 没传时 fork 项继续走
 * onPlaceholder（保持向后兼容，老 ProjectSidebar consumer 不会爆）。
 */
export type SessionMenuItemsProps = {
  onCopyId: () => void;
  onCopyLink: () => void;
  onPlaceholder: (action: string) => void;
  onForkSame?: () => void;
  onForkNew?: () => void;
};

export type SessionContextMenuProps = SessionMenuItemsProps & {
  children: React.ReactNode;
};

export function SessionContextMenu({
  onCopyId,
  onCopyLink,
  onPlaceholder,
  onForkSame,
  onForkNew,
  children
}: SessionContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-[200px]"
        data-testid="session-context-menu"
      >
        <SessionMenuBody
          onCopyId={onCopyId}
          onCopyLink={onCopyLink}
          onForkNew={onForkNew}
          onForkSame={onForkSame}
          onPlaceholder={onPlaceholder}
          variant="context"
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function SessionDropdownTrigger({
  onCopyId,
  onCopyLink,
  onPlaceholder,
  onForkSame,
  onForkNew
}: SessionMenuItemsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="会话操作"
          data-testid="session-row-menu-button"
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal aria-hidden="true" size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[200px]"
        data-testid="session-dropdown-menu"
      >
        <SessionMenuBody
          onCopyId={onCopyId}
          onCopyLink={onCopyLink}
          onForkNew={onForkNew}
          onForkSame={onForkSame}
          onPlaceholder={onPlaceholder}
          variant="dropdown"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type SessionMenuBodyProps = SessionMenuItemsProps & {
  variant: "context" | "dropdown";
};

/**
 * 共享菜单项 body —— ContextMenu 与 DropdownMenu 共用。两个 primitive
 * 的 Item / Label / Separator API 完全同形，靠 variant 切。
 */
function SessionMenuBody({
  onCopyId,
  onCopyLink,
  onPlaceholder,
  onForkSame,
  onForkNew,
  variant
}: SessionMenuBodyProps) {
  const Item = variant === "context" ? ContextMenuItem : DropdownMenuItem;
  const Label = variant === "context" ? ContextMenuLabel : DropdownMenuLabel;
  const Separator =
    variant === "context" ? ContextMenuSeparator : DropdownMenuSeparator;

  return (
    <>
      <Label>会话操作</Label>
      <Item
        data-testid="session-menu-pin"
        onSelect={() => onPlaceholder("置顶对话")}
      >
        <PinIcon aria-hidden="true" size={14} />
        <span>置顶对话</span>
      </Item>
      <Item
        data-testid="session-menu-rename"
        onSelect={() => onPlaceholder("重命名对话")}
      >
        <PencilIcon aria-hidden="true" size={14} />
        <span>重命名对话</span>
      </Item>
      <Item
        data-testid="session-menu-archive"
        onSelect={() => onPlaceholder("归档对话")}
      >
        <ArchiveIcon aria-hidden="true" size={14} />
        <span>归档对话</span>
      </Item>
      <Item
        data-testid="session-menu-unread"
        onSelect={() => onPlaceholder("标记为未读")}
      >
        <MailOpenIcon aria-hidden="true" size={14} />
        <span>标记为未读</span>
      </Item>
      <Separator />
      <Item
        data-testid="session-menu-explorer"
        onSelect={() => onPlaceholder("在资源管理器中打开")}
      >
        <ExternalLinkIcon aria-hidden="true" size={14} />
        <span>在资源管理器中打开</span>
      </Item>
      <Item
        data-testid="session-menu-copy-cwd"
        onSelect={() => onPlaceholder("复制工作目录")}
      >
        <CopyIcon aria-hidden="true" size={14} />
        <span>复制工作目录</span>
      </Item>
      <Item
        data-testid="session-menu-copy-id"
        onSelect={() => onCopyId()}
      >
        <CopyIcon aria-hidden="true" size={14} />
        <span>复制会话 ID</span>
      </Item>
      <Item
        data-testid="session-menu-copy-link"
        onSelect={() => onCopyLink()}
      >
        <Link2Icon aria-hidden="true" size={14} />
        <span>复制深度链接</span>
      </Item>
      <Separator />
      <Item
        data-testid="session-menu-fork-same"
        onSelect={() =>
          onForkSame ? onForkSame() : onPlaceholder("分叉到同一工作树")
        }
      >
        <GitBranchIcon aria-hidden="true" size={14} />
        <span>分叉到同一工作树</span>
      </Item>
      <Item
        data-testid="session-menu-fork-new"
        onSelect={() =>
          onForkNew ? onForkNew() : onPlaceholder("派生到新工作树")
        }
      >
        <FolderGit2 aria-hidden="true" size={14} />
        <span>派生到新工作树</span>
      </Item>
      <Item
        data-testid="session-menu-mini"
        onSelect={() => onPlaceholder("在迷你窗口中打开")}
      >
        <PanelTopIcon aria-hidden="true" size={14} />
        <span>在迷你窗口中打开</span>
      </Item>
    </>
  );
}
