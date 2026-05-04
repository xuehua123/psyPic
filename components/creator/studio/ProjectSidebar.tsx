"use client";

import * as React from "react";
import { MessageSquarePlus, Plus } from "lucide-react";

import type {
  CreatorConversationId,
  CreatorProjectId
} from "@/lib/creator/types";
import type {
  CreatorProjectMeta,
  SidebarProjectBranchSummary,
  SidebarProjectGroup
} from "@/lib/creator/projects";
import { useCollapsedProjects } from "@/lib/creator/use-collapsed-projects";
import { cn } from "@/lib/utils";

import NewProjectDialog from "./NewProjectDialog";
import ProjectCard from "./ProjectCard";
import ProjectDeleteAlert from "./ProjectDeleteAlert";
import ProjectRenameDialog from "./ProjectRenameDialog";
import SessionRenameDialog from "./SessionRenameDialog";
import {
  SidebarToastProvider,
  useSidebarToast
} from "./SidebarToast";

/**
 * 工作台左侧栏 · 平铺折叠卡版（plan slug clever-swimming-pumpkin）。
 *
 * 结构：
 *   顶部条       创作台 + 新建对话
 *   ProjectCardList  所有项目按 sortOrder 平铺；每张卡独立折叠
 *   + 新建项目
 *
 * 关键交互：
 *   - 点项目卡 header → toggle 该卡折叠（位置不变；不切 active）
 *   - 点卡内 session row 或「全部对话」→ 切 active project + active
 *     conversation
 *   - 折叠状态记 localStorage（useCollapsedProjects），刷新保留
 *   - active 与折叠状态完全正交：active 仅外观（边框 + 加粗）
 *
 * 数据流：sidebarProjects / activeProjectId / activeConversationId 从
 * props 来；CRUD 通过 onCreateProject / onRenameProject / onDeleteProject
 * 转发到上层 useProjects hook。
 */
export type ProjectSidebarProps = {
  sidebarProjects: SidebarProjectGroup[];
  activeProjectId: CreatorProjectId;
  activeConversationId: CreatorConversationId;
  activeProjectTitle: string;
  onSelectProject: (projectId: CreatorProjectId) => void;
  onSelectConversation: (conversationId: CreatorConversationId) => void;
  onCreateProject?: (title: string) => Promise<unknown> | unknown;
  onRenameProject?: (
    projectId: CreatorProjectId,
    title: string
  ) => Promise<unknown> | unknown;
  onDeleteProject?: (projectId: CreatorProjectId) => Promise<unknown> | unknown;
  /** 「分叉到同一工作树」—— 在该项目下从 branch.latestNode 起新分叉。 */
  onForkSession?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => Promise<unknown> | unknown;
  /** 「派生到新工作树」—— 创建新项目并以 branch.latestNode 的
   *  prompt+params 作为新项目的 Composer 起点。 */
  onDeriveSession?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => Promise<unknown> | unknown;
  /** 「置顶对话」/「取消置顶」 */
  onTogglePinSession?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => Promise<unknown> | unknown;
  /** 「重命名对话」 —— sidebar 内部弹 SessionRenameDialog 完成（不需要上层
   *  传新值，上层只负责把 customLabel 写到 branch-meta-store）。 */
  onRenameSession?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary,
    label: string
  ) => Promise<unknown> | unknown;
  /** 「归档对话」/「恢复对话」 */
  onToggleArchiveSession?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => Promise<unknown> | unknown;
  /** 「标记为未读」 */
  onMarkSessionUnread?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => Promise<unknown> | unknown;
};

export default function ProjectSidebar(props: ProjectSidebarProps) {
  return (
    <SidebarToastProvider>
      <ProjectSidebarContent {...props} />
    </SidebarToastProvider>
  );
}

function ProjectSidebarContent({
  sidebarProjects,
  activeProjectId,
  activeConversationId,
  onSelectProject,
  onSelectConversation,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onForkSession,
  onDeriveSession,
  onTogglePinSession,
  onRenameSession,
  onToggleArchiveSession,
  onMarkSessionUnread
}: ProjectSidebarProps) {
  const toast = useSidebarToast();

  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] =
    React.useState<CreatorProjectMeta | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<CreatorProjectMeta | null>(null);
  const [renameSessionTarget, setRenameSessionTarget] = React.useState<{
    projectId: CreatorProjectId;
    branch: SidebarProjectBranchSummary;
  } | null>(null);

  const projectIds = React.useMemo(
    () => sidebarProjects.map((group) => group.project.id),
    [sidebarProjects]
  );
  const { isCollapsed, toggle } = useCollapsedProjects(
    projectIds,
    activeProjectId
  );

  const isNewConversation = activeConversationId === "new";

  const handleKebabPlaceholder = React.useCallback(
    (label: string) => {
      const isDesktopOnly =
        label.includes("资源管理器") || label.includes("工作树");
      toast.show(
        isDesktopOnly
          ? `「${label}」为桌面端独占功能 · 请使用 Tauri 客户端`
          : `「${label}」即将上线`
      );
    },
    [toast]
  );

  async function handleCreateProject(title: string) {
    if (!onCreateProject) {
      toast.show("「新建项目」即将上线");
      return;
    }
    await onCreateProject(title);
    toast.show(`项目「${title}」已创建`, "success");
  }

  async function handleRenameProject(title: string) {
    if (!renameTarget || !onRenameProject) {
      return;
    }
    await onRenameProject(renameTarget.id, title);
    toast.show(`已重命名为「${title}」`, "success");
  }

  async function handleDeleteProject() {
    if (!deleteTarget || !onDeleteProject) {
      return;
    }
    const title = deleteTarget.title;
    await onDeleteProject(deleteTarget.id);
    toast.show(`项目「${title}」已移除`, "success");
  }

  /** 包一层把 toast 反馈接上 —— 父级 callback 只管业务，文案在 sidebar 内。 */
  const handleForkSessionWithToast = onForkSession
    ? async (
        projectId: CreatorProjectId,
        branch: SidebarProjectBranchSummary
      ) => {
        await onForkSession(projectId, branch);
        toast.show("已分叉，请在 Composer 中输入新 prompt", "success");
      }
    : undefined;

  const handleDeriveSessionWithToast = onDeriveSession
    ? async (
        projectId: CreatorProjectId,
        branch: SidebarProjectBranchSummary
      ) => {
        await onDeriveSession(projectId, branch);
        toast.show("已派生到新项目，可在 Composer 中继续", "success");
      }
    : undefined;

  const handleTogglePinWithToast = onTogglePinSession
    ? async (
        projectId: CreatorProjectId,
        branch: SidebarProjectBranchSummary
      ) => {
        const wasPinned = branch.isPinned ?? false;
        await onTogglePinSession(projectId, branch);
        toast.show(wasPinned ? "已取消置顶" : "已置顶对话", "success");
      }
    : undefined;

  const handleToggleArchiveWithToast = onToggleArchiveSession
    ? async (
        projectId: CreatorProjectId,
        branch: SidebarProjectBranchSummary
      ) => {
        const wasArchived = branch.isArchived ?? false;
        await onToggleArchiveSession(projectId, branch);
        toast.show(wasArchived ? "已恢复对话" : "已归档对话", "success");
      }
    : undefined;

  const handleMarkUnreadWithToast = onMarkSessionUnread
    ? async (
        projectId: CreatorProjectId,
        branch: SidebarProjectBranchSummary
      ) => {
        await onMarkSessionUnread(projectId, branch);
        toast.show("已标记为未读", "success");
      }
    : undefined;

  /** Rename 走 Dialog —— 不直接调上层 callback；上层最终通过 dialog
   *  submit 接到带 label 的 onRenameSession。 */
  const handleOpenRenameSession = onRenameSession
    ? (projectId: CreatorProjectId, branch: SidebarProjectBranchSummary) => {
        setRenameSessionTarget({ projectId, branch });
      }
    : undefined;

  async function handleSubmitSessionRename(label: string) {
    if (!renameSessionTarget || !onRenameSession) {
      return;
    }
    const { projectId, branch } = renameSessionTarget;
    await onRenameSession(projectId, branch, label);
    toast.show(
      label.trim().length > 0 ? "已重命名" : "已恢复默认标题",
      "success"
    );
  }

  const renameSessionInitialTitle =
    renameSessionTarget?.branch.customLabel ??
    renameSessionTarget?.branch.latestNode?.prompt.slice(0, 80) ??
    renameSessionTarget?.branch.label ??
    "";

  return (
    <aside
      aria-label="项目与对话"
      className="project-sidebar"
      data-testid="left-parameter-panel"
    >
      <div className="project-brand">
        <span className="sidebar-section-title">创作台</span>
        <button
          aria-pressed={isNewConversation}
          className={cn("project-create-button", isNewConversation && "active")}
          onClick={() => onSelectConversation("new")}
          type="button"
        >
          <MessageSquarePlus size={16} aria-hidden="true" />
          <span>新建对话</span>
        </button>
      </div>

      <div
        className="sidebar-fill grid gap-1 px-1.5 pb-2"
        data-testid="project-card-list"
      >
        {sidebarProjects.map((group) => (
          <ProjectCard
            activeConversationId={activeConversationId}
            activeProjectId={activeProjectId}
            group={group}
            isActive={group.project.id === activeProjectId}
            isCollapsed={isCollapsed(group.project.id)}
            key={group.project.id}
            onDelete={() => setDeleteTarget(group.project)}
            onDeriveSession={handleDeriveSessionWithToast}
            onForkSession={handleForkSessionWithToast}
            onMarkSessionUnread={handleMarkUnreadWithToast}
            onRenameSession={handleOpenRenameSession}
            onToggleArchiveSession={handleToggleArchiveWithToast}
            onTogglePinSession={handleTogglePinWithToast}
            onKebabPlaceholder={handleKebabPlaceholder}
            onRename={() => setRenameTarget(group.project)}
            onSelectConversation={onSelectConversation}
            onSelectProject={onSelectProject}
            onToggleCollapse={() => toggle(group.project.id)}
          />
        ))}

        <button
          className="mt-1 flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          data-testid="new-project-button"
          onClick={() => setNewProjectOpen(true)}
          type="button"
        >
          <Plus aria-hidden="true" className="size-3.5 shrink-0" />
          <span>新建项目</span>
        </button>
      </div>

      <NewProjectDialog
        onOpenChange={setNewProjectOpen}
        onSubmit={handleCreateProject}
        open={newProjectOpen}
      />
      <ProjectRenameDialog
        initialTitle={renameTarget?.title ?? ""}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
          }
        }}
        onSubmit={handleRenameProject}
        open={renameTarget !== null}
      />
      <ProjectDeleteAlert
        onConfirm={handleDeleteProject}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={deleteTarget !== null}
        projectCount={sidebarProjects.length}
        projectTitle={deleteTarget?.title ?? ""}
      />
      <SessionRenameDialog
        initialTitle={renameSessionInitialTitle}
        onOpenChange={(open) => {
          if (!open) {
            setRenameSessionTarget(null);
          }
        }}
        onSubmit={handleSubmitSessionRename}
        open={renameSessionTarget !== null}
      />
    </aside>
  );
}
