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
  onDeriveSession
}: ProjectSidebarProps) {
  const toast = useSidebarToast();

  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] =
    React.useState<CreatorProjectMeta | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<CreatorProjectMeta | null>(null);

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
        `「${label}」${isDesktopOnly ? "为桌面端功能" : "即将上线"}`
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
        // 派生 toast 文案在 CreatorWorkspace 里有新项目名，那边已经 show；
        // 这里不重复 show，避免双 toast。
      }
    : undefined;

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
    </aside>
  );
}
