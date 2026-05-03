"use client";

import { ChevronDown, ChevronRight, Folder, MessageSquarePlus } from "lucide-react";

import type {
  CreatorConversationId,
  CreatorProjectId
} from "@/lib/creator/types";
import type { SidebarProjectGroup } from "@/lib/creator/projects";

/**
 * 工作台左侧栏：当前项目品牌 + 新建对话按钮 + 项目/对话/分支三层
 * 树。激活的项目展开显示其所有 branch，分支按 latestNode 的 prompt
 * 摘要做标题。
 *
 * 来自原 CreatorWorkspace.tsx L1561-1676（4116 行单文件巨兽拆分计划
 * 的第九刀）。地图"第二波" #7。当前实现保留原视觉与 className，后续
 * Phase 5 会按 spec 把深色 #0d141d 改为浅色 + accent 描边激活态。
 */
type ProjectSidebarProps = {
  sidebarProjects: SidebarProjectGroup[];
  activeProjectId: CreatorProjectId;
  activeConversationId: CreatorConversationId;
  activeProjectTitle: string;
  onSelectProject: (projectId: CreatorProjectId) => void;
  onSelectConversation: (conversationId: CreatorConversationId) => void;
};

export default function ProjectSidebar({
  sidebarProjects,
  activeProjectId,
  activeConversationId,
  activeProjectTitle,
  onSelectProject,
  onSelectConversation
}: ProjectSidebarProps) {
  return (
    <aside
      aria-label="项目与对话"
      className="project-sidebar"
      data-testid="left-parameter-panel"
    >
      <div className="project-brand">
        <span className="sidebar-section-title">创作台</span>
        <button
          aria-pressed={activeConversationId === "new"}
          className={`project-create-button ${
            activeConversationId === "new" ? "active" : ""
          }`}
          onClick={() => onSelectConversation("new")}
          type="button"
        >
          <MessageSquarePlus size={16} aria-hidden="true" />
          <span>新建对话</span>
        </button>
        <p className="project-context-note">
          当前项目 · {activeProjectTitle}
        </p>
      </div>

      <div className="project-sidebar-tree sidebar-fill">
        {sidebarProjects.map((item) => {
          const isActiveProject = activeProjectId === item.project.id;

          return (
            <section
              className={`project-tree-group ${
                isActiveProject ? "active" : ""
              }`}
              key={item.project.id}
            >
              <button
                aria-pressed={isActiveProject}
                className={`project-row project-tree-row ${
                  isActiveProject ? "active" : ""
                }`}
                onClick={() => onSelectProject(item.project.id)}
                type="button"
              >
                <span className="project-row-copy">
                  <Folder size={15} aria-hidden="true" />
                  <span>
                    <strong>{item.project.title}</strong>
                    <small>
                      {item.nodes.length > 0
                        ? `${item.nodes.length} 个历史节点`
                        : item.project.description}
                    </small>
                  </span>
                </span>
                <span className="project-row-meta">
                  <span className="template-pill">{item.nodes.length}</span>
                  {isActiveProject ? (
                    <ChevronDown size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} aria-hidden="true" />
                  )}
                </span>
              </button>

              {isActiveProject ? (
                <div
                  className="project-conversation-tree"
                  data-testid="project-conversation-tree"
                >
                  <button
                    aria-pressed={activeConversationId === "all"}
                    className={`conversation-row ${
                      activeConversationId === "all" ? "active" : ""
                    }`}
                    onClick={() => onSelectConversation("all")}
                    type="button"
                  >
                    <span>
                      <strong>{item.project.emptyTitle}</strong>
                      <small>
                        全部对话 · {item.nodes.length || 0} 次生成
                      </small>
                    </span>
                  </button>
                  {item.branchSummaries.map((branch) => (
                    <button
                      aria-pressed={
                        activeConversationId === `branch:${branch.id}`
                      }
                      className={`conversation-row ${
                        activeConversationId === `branch:${branch.id}`
                          ? "active"
                          : ""
                      }`}
                      key={branch.id}
                      onClick={() =>
                        onSelectConversation(`branch:${branch.id}`)
                      }
                      type="button"
                    >
                      <span>
                        <strong>
                          {branch.latestNode?.prompt.slice(0, 24) ||
                            branch.label}
                        </strong>
                        <small>
                          {branch.label} · {branch.count} 个历史节点
                        </small>
                      </span>
                    </button>
                  ))}
                  {item.nodes.length === 0 ? (
                    <div className="conversation-empty">还没有生成记录</div>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
