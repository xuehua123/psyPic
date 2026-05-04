"use client";

import * as React from "react";
import { ChevronRight, Folder, FolderOpen, MessageSquarePlus } from "lucide-react";

import type {
  CreatorConversationId,
  CreatorProjectId
} from "@/lib/creator/types";
import type {
  SidebarProjectBranchSummary,
  SidebarProjectGroup
} from "@/lib/creator/projects";
import { bucketByActivity } from "@/lib/creator/session-buckets";
import { formatVersionNodeTime } from "@/lib/creator/version-graph";
import { cn } from "@/lib/utils";

import ProjectKebabMenu from "./ProjectKebabMenu";
import {
  SessionContextMenu,
  SessionDropdownTrigger
} from "./SessionRowMenu";
import { useSidebarToast } from "./SidebarToast";

/**
 * 单个项目卡：可折叠 header + 展开后内嵌该项目的 4 桶 session 列表。
 *
 * 设计要点（plan slug clever-swimming-pumpkin · Cut 2）：
 *
 * - **collapse 与 active 解耦**：点 header 只 toggle collapse，绝不切 active；
 *   切 active 由「全部对话」row 或 session row 触发（同时调
 *   onSelectProject + onSelectConversation）
 * - **active 高亮**：仅外观（边框 + 强调色），不影响位置；多卡平铺时
 *   active 卡可能在中间任意位置
 * - kebab 用 `e.stopPropagation()` 阻止冒到 header（不然点 kebab 会同时
 *   toggle 折叠状态）
 *
 * 4 桶 session 渲染逻辑沿用 plan slug cosmic-tumbling-narwhal · Cut 4 的
 * data-testid（session-bucket-{key} / conversation-row-branch）以保持
 * 测试稳定。
 */

const BUCKET_LABELS: Array<{
  key: "today" | "yesterday" | "thisWeek" | "earlier";
  label: string;
}> = [
  { key: "today", label: "今天" },
  { key: "yesterday", label: "昨天" },
  { key: "thisWeek", label: "本周" },
  { key: "earlier", label: "更早" }
];

export type ProjectCardProps = {
  group: SidebarProjectGroup;
  isActive: boolean;
  isCollapsed: boolean;
  /** 当前 active conversation id —— 仅用于该 card 内 row 的高亮判断。
   *  非 active 卡的 session row 不会拿到高亮（因为 active project 不一样）。 */
  activeConversationId: CreatorConversationId;
  /** 当前 active project id —— 仅用于深度链接里 ?project= 参数。 */
  activeProjectId: CreatorProjectId;
  onToggleCollapse: () => void;
  /** 切 active 项目（点全部对话 / session row 时同时调）。 */
  onSelectProject: (projectId: CreatorProjectId) => void;
  onSelectConversation: (conversationId: CreatorConversationId) => void;
  onRename: () => void;
  onDelete: () => void;
  onKebabPlaceholder: (label: string) => void;
  /** 「分叉到同一工作树」—— 在该 card 项目下从 branch.latestNode 起新分叉。
   *  optional：不传则 SessionRowMenu 走 onPlaceholder。 */
  onForkSession?: (projectId: CreatorProjectId, branch: SidebarProjectBranchSummary) => void;
  /** 「派生到新工作树」—— 创建新项目，把 branch.latestNode 的 prompt+params
   *  作为新项目的起点。 optional：同上。 */
  onDeriveSession?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => void;
  /** 「置顶对话」/「取消置顶」—— 切换 branch 的 isPinned。 */
  onTogglePinSession?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => void;
  /** 「重命名对话」—— 弹 Dialog 改 customLabel。 */
  onRenameSession?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => void;
  /** 「归档对话」/「恢复对话」—— 切换 branch 的 isArchived。 */
  onToggleArchiveSession?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => void;
  /** 「标记为未读」—— 清除 branch 的 lastReadAt 让 indicator 重新出现。 */
  onMarkSessionUnread?: (
    projectId: CreatorProjectId,
    branch: SidebarProjectBranchSummary
  ) => void;
};

export default function ProjectCard({
  group,
  isActive,
  isCollapsed,
  activeConversationId,
  activeProjectId,
  onToggleCollapse,
  onSelectProject,
  onSelectConversation,
  onRename,
  onDelete,
  onKebabPlaceholder,
  onForkSession,
  onDeriveSession,
  onTogglePinSession,
  onRenameSession,
  onToggleArchiveSession,
  onMarkSessionUnread
}: ProjectCardProps) {
  const [showArchived, setShowArchived] = React.useState(false);
  const archivedCount = React.useMemo(
    () => group.branchSummaries.filter((branch) => branch.isArchived).length,
    [group.branchSummaries]
  );
  const visibleBranches = React.useMemo(
    () =>
      showArchived
        ? group.branchSummaries
        : group.branchSummaries.filter((branch) => !branch.isArchived),
    [group.branchSummaries, showArchived]
  );
  const pinnedBranches = React.useMemo(
    () =>
      visibleBranches
        .filter((branch) => branch.isPinned)
        .sort((left, right) => {
          const leftTime = left.latestNode?.createdAt ?? "";
          const rightTime = right.latestNode?.createdAt ?? "";
          return rightTime.localeCompare(leftTime);
        }),
    [visibleBranches]
  );
  const unpinnedBranches = React.useMemo(
    () => visibleBranches.filter((branch) => !branch.isPinned),
    [visibleBranches]
  );
  const buckets = React.useMemo(
    () => bucketByActivity(unpinnedBranches),
    [unpinnedBranches]
  );
  const totalSessions = visibleBranches.length;
  const projectId = group.project.id;

  // 「全部对话」row 是否高亮：active project 命中 + activeConversationId === "all"
  const isAllRowActive = isActive && activeConversationId === "all";

  function handleSelectAll() {
    onSelectProject(projectId);
    onSelectConversation("all");
  }

  function handleSelectBranch(conversationId: CreatorConversationId) {
    if (!isActive) {
      onSelectProject(projectId);
    }
    onSelectConversation(conversationId);
  }

  return (
    <div
      className={cn(
        "rounded-md border transition-colors",
        isActive
          ? "border-accent/40 bg-accent-soft/40"
          : "border-transparent hover:border-border"
      )}
      data-active={isActive ? "true" : "false"}
      data-collapsed={isCollapsed ? "true" : "false"}
      data-testid={`project-card-${projectId}`}
    >
      <div
        aria-expanded={!isCollapsed}
        aria-label={`${group.project.title} · ${isCollapsed ? "已折叠" : "已展开"}`}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left",
          "hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        data-testid={`project-card-header-${projectId}`}
        onClick={onToggleCollapse}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleCollapse();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            !isCollapsed && "rotate-90"
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            isActive
              ? "bg-accent-soft text-accent-strong"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-sm leading-tight",
              isActive ? "font-semibold" : "font-medium"
            )}
            data-testid={`project-card-title-${projectId}`}
          >
            {group.project.title}
          </div>
        </div>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {totalSessions}
        </span>
        <button
          aria-label={`在「${group.project.title}」下新建对话`}
          className={cn(
            "shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors",
            "hover:bg-accent/20 hover:text-accent-strong",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          data-testid={`project-card-new-conversation-${projectId}`}
          onClick={(event) => {
            // 阻止冒到 header（不然会同时折叠/展开），并把 active 切到该卡 +
            // 起一条新对话。
            event.stopPropagation();
            onSelectProject(projectId);
            onSelectConversation("new");
          }}
          onKeyDown={(event) => event.stopPropagation()}
          type="button"
        >
          <MessageSquarePlus aria-hidden="true" size={14} />
        </button>
        <div
          // 关键：阻止冒到 header 的 toggle，否则点 kebab 同时折叠/展开
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <ProjectKebabMenu
            onDelete={onDelete}
            onPlaceholder={onKebabPlaceholder}
            onRename={onRename}
          />
        </div>
      </div>

      {isCollapsed ? null : (
        <div className="grid gap-2 px-1.5 pb-2 pt-1">
          <button
            aria-pressed={isAllRowActive}
            className={cn(
              "flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors hover:border-border hover:bg-accent/10",
              isAllRowActive &&
                "border-accent bg-accent-soft text-accent-strong"
            )}
            data-testid={`conversation-row-all-${projectId}`}
            onClick={handleSelectAll}
            type="button"
          >
            <span className="font-medium">全部对话</span>
            <span className="text-xs text-muted-foreground">
              {group.nodes.length} 个节点
            </span>
          </button>

          {totalSessions === 0 ? (
            <div
              className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground"
              data-testid={`session-list-empty-${projectId}`}
            >
              还没有生成记录。
            </div>
          ) : (
            <>
              {pinnedBranches.length > 0 ? (
                <section
                  aria-label="置顶"
                  className="grid gap-1"
                  data-bucket="pinned"
                  data-testid="session-bucket-pinned"
                >
                  <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    置顶
                    <span className="ml-1 text-muted-foreground/70">
                      {pinnedBranches.length}
                    </span>
                  </div>
                  {pinnedBranches.map((branch) => (
                    <SessionRow
                      activeConversationId={activeConversationId}
                      activeProjectId={activeProjectId}
                      branch={branch}
                      isProjectActive={isActive}
                      key={branch.id}
                      onDeriveSession={
                        onDeriveSession
                          ? () => onDeriveSession(projectId, branch)
                          : undefined
                      }
                      onForkSession={
                        onForkSession
                          ? () => onForkSession(projectId, branch)
                          : undefined
                      }
                      onMarkUnread={
                        onMarkSessionUnread
                          ? () => onMarkSessionUnread(projectId, branch)
                          : undefined
                      }
                      onRename={
                        onRenameSession
                          ? () => onRenameSession(projectId, branch)
                          : undefined
                      }
                      onSelect={handleSelectBranch}
                      onToggleArchive={
                        onToggleArchiveSession
                          ? () => onToggleArchiveSession(projectId, branch)
                          : undefined
                      }
                      onTogglePin={
                        onTogglePinSession
                          ? () => onTogglePinSession(projectId, branch)
                          : undefined
                      }
                    />
                  ))}
                </section>
              ) : null}
              {BUCKET_LABELS.map(({ key, label }) => {
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
                        activeProjectId={activeProjectId}
                        branch={branch}
                        isProjectActive={isActive}
                        key={branch.id}
                        onDeriveSession={
                          onDeriveSession
                            ? () => onDeriveSession(projectId, branch)
                            : undefined
                        }
                        onForkSession={
                          onForkSession
                            ? () => onForkSession(projectId, branch)
                            : undefined
                        }
                        onMarkUnread={
                          onMarkSessionUnread
                            ? () => onMarkSessionUnread(projectId, branch)
                            : undefined
                        }
                        onRename={
                          onRenameSession
                            ? () => onRenameSession(projectId, branch)
                            : undefined
                        }
                        onSelect={handleSelectBranch}
                        onToggleArchive={
                          onToggleArchiveSession
                            ? () => onToggleArchiveSession(projectId, branch)
                            : undefined
                        }
                        onTogglePin={
                          onTogglePinSession
                            ? () => onTogglePinSession(projectId, branch)
                            : undefined
                        }
                      />
                    ))}
                  </section>
                );
              })}
            </>
          )}
          {archivedCount > 0 ? (
            <button
              className="mt-1 flex items-center justify-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              data-testid={`toggle-archived-${projectId}`}
              onClick={() => setShowArchived((prev) => !prev)}
              type="button"
            >
              {showArchived ? `隐藏归档` : `显示归档（${archivedCount}）`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

type SessionRowProps = {
  branch: SidebarProjectBranchSummary;
  activeConversationId: CreatorConversationId;
  activeProjectId: CreatorProjectId;
  /** 该 row 所属的卡是否是 active 项目；非 active 卡的 row 永远不高亮 */
  isProjectActive: boolean;
  onSelect: (id: CreatorConversationId) => void;
  onForkSession?: () => void;
  onDeriveSession?: () => void;
  onTogglePin?: () => void;
  onRename?: () => void;
  onToggleArchive?: () => void;
  onMarkUnread?: () => void;
};

function SessionRow({
  branch,
  activeConversationId,
  activeProjectId,
  isProjectActive,
  onSelect,
  onForkSession,
  onDeriveSession,
  onTogglePin,
  onRename,
  onToggleArchive,
  onMarkUnread
}: SessionRowProps) {
  const toast = useSidebarToast();
  const id: CreatorConversationId = `branch:${branch.id}`;
  const isActive = isProjectActive && activeConversationId === id;
  const fallbackTitle =
    branch.latestNode?.prompt.slice(0, 28) || branch.label;
  const title = branch.customLabel ?? fallbackTitle;
  const time = branch.latestNode
    ? formatVersionNodeTime(branch.latestNode)
    : "未生成";

  const handleCopyId = React.useCallback(() => {
    void copyToClipboard(branch.id);
    toast.show("会话 ID 已复制", "success");
  }, [branch.id, toast]);

  const handleCopyLink = React.useCallback(() => {
    const link = buildDeepLink(activeProjectId, branch.id);
    void copyToClipboard(link);
    toast.show("深度链接已复制", "success");
  }, [activeProjectId, branch.id, toast]);

  const handlePlaceholder = React.useCallback(
    (label: string) => {
      // 实做后 SessionRowMenu 占位只剩 3 项桌面端独占功能。
      // 文案明确告知用户「web 端不可达 · Tauri 桌面客户端可用」。
      const isDesktopOnly =
        label.includes("资源管理器") ||
        label.includes("工作目录") ||
        label.includes("迷你窗口") ||
        label.includes("工作树");
      toast.show(
        isDesktopOnly
          ? `「${label}」为桌面端独占功能 · 请使用 Tauri 客户端`
          : `「${label}」即将上线`
      );
    },
    [toast]
  );

  return (
    <SessionContextMenu
      isArchived={branch.isArchived}
      isPinned={branch.isPinned}
      onCopyId={handleCopyId}
      onCopyLink={handleCopyLink}
      onForkNew={onDeriveSession}
      onForkSame={onForkSession}
      onMarkUnread={onMarkUnread}
      onPlaceholder={handlePlaceholder}
      onRename={onRename}
      onToggleArchive={onToggleArchive}
      onTogglePin={onTogglePin}
    >
      <div className="group/row relative">
        <button
          aria-pressed={isActive}
          className={cn(
            "flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors",
            "hover:border-border hover:bg-accent/10",
            isActive && "border-accent bg-accent-soft text-accent-strong"
          )}
          data-testid="conversation-row-branch"
          data-unread={branch.hasUnread ? "true" : "false"}
          onClick={() => onSelect(id)}
          type="button"
        >
          {branch.hasUnread ? (
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
              data-testid="session-unread-indicator"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "truncate leading-tight",
                branch.hasUnread ? "font-semibold" : "font-medium"
              )}
              title={title}
            >
              {title}
            </div>
            <div className="truncate text-[11px] leading-snug text-muted-foreground">
              {branch.label} · {branch.count} 个节点 · {time}
            </div>
          </div>
        </button>
        <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100 md:opacity-0 max-md:opacity-100">
          <SessionDropdownTrigger
            isArchived={branch.isArchived}
            isPinned={branch.isPinned}
            onCopyId={handleCopyId}
            onCopyLink={handleCopyLink}
            onForkNew={onDeriveSession}
            onForkSame={onForkSession}
            onMarkUnread={onMarkUnread}
            onPlaceholder={handlePlaceholder}
            onRename={onRename}
            onToggleArchive={onToggleArchive}
            onTogglePin={onTogglePin}
          />
        </div>
      </div>
    </SessionContextMenu>
  );
}

function buildDeepLink(projectId: CreatorProjectId, branchId: string): string {
  if (typeof window === "undefined") {
    return `?project=${projectId}&conversation=branch:${branchId}`;
  }
  const url = new URL(window.location.href);
  url.search = `?project=${projectId}&conversation=branch:${branchId}`;
  return url.toString();
}

async function copyToClipboard(text: string): Promise<void> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // 老浏览器 / jsdom 早期：吃掉，让占位 toast 照常 success
}
