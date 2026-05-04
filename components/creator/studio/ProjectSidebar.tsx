"use client";

import * as React from "react";
import { Folder, MessageSquarePlus, Plus } from "lucide-react";

import type {
  CreatorConversationId,
  CreatorProjectId
} from "@/lib/creator/types";
import type {
  CreatorProjectMeta,
  SidebarProjectBranchSummary,
  SidebarProjectGroup
} from "@/lib/creator/projects";
import { bucketByActivity } from "@/lib/creator/session-buckets";
import { formatVersionNodeTime } from "@/lib/creator/version-graph";
import { cn } from "@/lib/utils";

import NewProjectDialog from "./NewProjectDialog";
import ProjectDeleteAlert from "./ProjectDeleteAlert";
import ProjectKebabMenu from "./ProjectKebabMenu";
import ProjectRenameDialog from "./ProjectRenameDialog";
import {
  SidebarToastProvider,
  useSidebarToast
} from "./SidebarToast";

/**
 * 工作台左侧栏：Codex 风 Session List。
 *
 * 结构：
 *   顶部条       创作台 + 新建对话
 *   项目头       icon + 项目名 + kebab（DropdownMenu）
 *   项目切换    其他项目 row 列表 + [+ 新建项目]
 *   session 列  按 today / yesterday / thisWeek / earlier 分组
 *
 * 数据流：sidebarProjects / activeProjectId / activeConversationId 从 props
 * 来；CRUD 通过 onCreateProject / onRenameProject / onDeleteProject 三个
 * callback 由 CreatorWorkspace 转发到 useProjects hook。
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
};

const BUCKET_LABELS: Array<{
  key: "today" | "yesterday" | "thisWeek" | "earlier";
  label: string;
}> = [
  { key: "today", label: "今天" },
  { key: "yesterday", label: "昨天" },
  { key: "thisWeek", label: "本周" },
  { key: "earlier", label: "更早" }
];

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
  onDeleteProject
}: ProjectSidebarProps) {
  const toast = useSidebarToast();

  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] =
    React.useState<CreatorProjectMeta | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<CreatorProjectMeta | null>(null);

  const activeGroup =
    sidebarProjects.find((group) => group.project.id === activeProjectId) ??
    sidebarProjects[0] ??
    null;
  const otherProjects = sidebarProjects.filter(
    (group) => group.project.id !== activeProjectId
  );

  const buckets = bucketByActivity(activeGroup?.branchSummaries ?? []);
  const isNewConversation = activeConversationId === "new";
  const isAllConversation = activeConversationId === "all";
  const totalSessions = activeGroup?.branchSummaries.length ?? 0;

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

      {activeGroup ? (
        <div className="flex items-center gap-2 px-1.5 py-2">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-strong"
          >
            <Folder size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-sm font-semibold leading-tight"
              data-testid="project-header-title"
            >
              {activeGroup.project.title}
            </div>
            <div className="truncate text-xs leading-snug text-muted-foreground">
              {activeGroup.nodes.length > 0
                ? `${totalSessions} 个对话 · ${activeGroup.nodes.length} 个节点`
                : activeGroup.project.description}
            </div>
          </div>
          <ProjectKebabMenu
            onDelete={() => setDeleteTarget(activeGroup.project)}
            onPlaceholder={handleKebabPlaceholder}
            onRename={() => setRenameTarget(activeGroup.project)}
          />
        </div>
      ) : null}

      {sidebarProjects.length > 0 ? (
        <div className="grid gap-1 px-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            其他项目
          </div>
          {otherProjects.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground">
              当前只有这一个项目。
            </div>
          ) : (
            otherProjects.map((group) => (
              <button
                className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors hover:border-border hover:bg-accent/10"
                data-testid="project-switch-row"
                key={group.project.id}
                onClick={() => onSelectProject(group.project.id)}
                type="button"
              >
                <Folder
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate">
                  {group.project.title}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {group.branchSummaries.length}
                </span>
              </button>
            ))
          )}
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
      ) : null}

      <div
        className="sidebar-fill grid gap-3 px-1.5 pb-2"
        data-testid="session-list"
      >
        <button
          aria-pressed={isAllConversation}
          className={cn(
            "flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors hover:border-border hover:bg-accent/10",
            isAllConversation && "border-accent bg-accent-soft text-accent-strong"
          )}
          data-testid="conversation-row-all"
          onClick={() => onSelectConversation("all")}
          type="button"
        >
          <span className="font-medium">全部对话</span>
          <span className="text-xs text-muted-foreground">
            {activeGroup?.nodes.length ?? 0} 个节点
          </span>
        </button>

        {totalSessions === 0 ? (
          <div
            className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground"
            data-testid="session-list-empty"
          >
            还没有生成记录。点击上方「新建对话」开始第一条。
          </div>
        ) : (
          BUCKET_LABELS.map(({ key, label }) => {
            const bucket = buckets[key];
            if (bucket.length === 0) {
              return null;
            }
            return (
              <section
                aria-label={label}
                className="grid gap-1"
                data-bucket={key}
                data-testid={`session-bucket-${key}`}
                key={key}
              >
                <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                  <span className="ml-1 text-muted-foreground/70">
                    {bucket.length}
                  </span>
                </div>
                {bucket.map((branch) => (
                  <SessionRow
                    activeConversationId={activeConversationId}
                    branch={branch}
                    key={branch.id}
                    onSelect={onSelectConversation}
                  />
                ))}
              </section>
            );
          })
        )}
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

type SessionRowProps = {
  branch: SidebarProjectBranchSummary;
  activeConversationId: CreatorConversationId;
  onSelect: (id: CreatorConversationId) => void;
};

function SessionRow({
  branch,
  activeConversationId,
  onSelect
}: SessionRowProps) {
  const id: CreatorConversationId = `branch:${branch.id}`;
  const isActive = activeConversationId === id;
  const title = branch.latestNode?.prompt.slice(0, 28) || branch.label;
  const time = branch.latestNode
    ? formatVersionNodeTime(branch.latestNode)
    : "未生成";

  return (
    <div className="group/row relative">
      <button
        aria-pressed={isActive}
        className={cn(
          "flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors",
          "hover:border-border hover:bg-accent/10",
          isActive && "border-accent bg-accent-soft text-accent-strong"
        )}
        data-testid="conversation-row-branch"
        onClick={() => onSelect(id)}
        type="button"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium leading-tight" title={title}>
            {title}
          </div>
          <div className="truncate text-[11px] leading-snug text-muted-foreground">
            {branch.label} · {branch.count} 个节点 · {time}
          </div>
        </div>
      </button>
    </div>
  );
}
