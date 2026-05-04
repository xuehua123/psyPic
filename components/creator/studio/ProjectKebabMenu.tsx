"use client";

import * as React from "react";
import {
  ArchiveIcon,
  ExternalLinkIcon,
  FolderGit2,
  MoreHorizontal,
  PencilIcon,
  PinIcon,
  Trash2Icon
} from "lucide-react";

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
 * 项目级 kebab 菜单 —— 6 项，2 项实做 / 4 项 placeholder。
 *
 * - 重命名项目：本轮实做（onRename）
 * - 移除：本轮实做（onDelete）
 * - 固定项目 / 在资源管理器中打开 / 创建永久工作树 / 归档对话：placeholder
 *   走 onPlaceholder("xxx") —— 父级转交 SidebarToast.show("即将上线")
 */
export type ProjectKebabMenuProps = {
  onRename: () => void;
  onDelete: () => void;
  onPlaceholder: (action: string) => void;
};

export default function ProjectKebabMenu({
  onRename,
  onDelete,
  onPlaceholder
}: ProjectKebabMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="项目操作"
          data-testid="project-kebab-button"
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal aria-hidden="true" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuLabel>项目操作</DropdownMenuLabel>
        <DropdownMenuItem
          data-testid="project-kebab-pin"
          onSelect={() => onPlaceholder("固定项目")}
        >
          <PinIcon aria-hidden="true" size={14} />
          <span>固定项目</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="project-kebab-explorer"
          onSelect={() => onPlaceholder("在资源管理器中打开")}
        >
          <ExternalLinkIcon aria-hidden="true" size={14} />
          <span>在资源管理器中打开</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="project-kebab-worktree"
          onSelect={() => onPlaceholder("创建永久工作树")}
        >
          <FolderGit2 aria-hidden="true" size={14} />
          <span>创建永久工作树</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="project-kebab-rename"
          onSelect={(event) => {
            event.preventDefault();
            onRename();
          }}
        >
          <PencilIcon aria-hidden="true" size={14} />
          <span>重命名项目</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="project-kebab-archive"
          onSelect={() => onPlaceholder("归档对话")}
        >
          <ArchiveIcon aria-hidden="true" size={14} />
          <span>归档对话</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="project-kebab-delete"
          onSelect={(event) => {
            event.preventDefault();
            onDelete();
          }}
          variant="destructive"
        >
          <Trash2Icon aria-hidden="true" size={14} />
          <span>移除</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
