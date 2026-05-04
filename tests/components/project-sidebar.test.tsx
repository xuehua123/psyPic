import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectSidebar from "@/components/creator/studio/ProjectSidebar";
import type {
  SidebarProjectBranchSummary,
  SidebarProjectGroup
} from "@/lib/creator/projects";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";

/**
 * 写于 Cut 4 —— 验证 ProjectSidebar 视觉骨架重写后的关键 invariant：
 * - 时间分组渲染（4 桶 SectionHeading）
 * - 项目切换：点 switch-row 触发 onSelectProject；header 显示 active 项目
 * - 空 session 文案
 * - 「+ 新建项目」「kebab」走 onPlaceholderAction（Cut 5 接通）
 *
 * 时间分桶逻辑覆盖在 tests/unit/session-buckets.test.ts；这里只验证
 * sidebar 是否把分桶结果正确渲染。
 */

const NODE_BASE: Omit<CreatorVersionNode, "id" | "branchId" | "createdAt" | "prompt"> = {
  parentId: null,
  branchLabel: "主线",
  depth: 0,
  status: "succeeded",
  params: {} as CreatorVersionNode["params"],
  images: [],
  source: "generation"
};

function makeBranch(
  id: string,
  prompt: string,
  iso: string
): SidebarProjectBranchSummary {
  return {
    id,
    label: "主线",
    count: 1,
    latestNode: {
      ...NODE_BASE,
      id: `node_${id}`,
      branchId: id,
      branchLabel: "主线",
      createdAt: iso,
      prompt
    } as CreatorVersionNode
  };
}

const todayIso = new Date().toISOString();
const yesterdayIso = (() => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(8, 0, 0, 0);
  return date.toISOString();
})();
const longAgoIso = "2024-01-01T08:00:00";

const TEST_PROJECTS: SidebarProjectGroup[] = [
  {
    project: {
      id: "commercial",
      title: "商业图库项目",
      description: "默认项目 · 本地工作区",
      emptyTitle: "商业图片创作",
      emptyDescription: "准备第一张结果图。"
    },
    nodes: [],
    branchSummaries: [
      makeBranch("branch-now", "今天的会话标题", todayIso),
      makeBranch("branch-yesterday", "昨天的会话", yesterdayIso),
      makeBranch("branch-old", "陈年老会话", longAgoIso)
    ]
  },
  {
    project: {
      id: "social",
      title: "社媒内容项目",
      description: "小红书、封面与信息流",
      emptyTitle: "社媒封面创作",
      emptyDescription: "为移动端内容流建立一条独立版本对话。"
    },
    nodes: [],
    branchSummaries: []
  }
];

describe("ProjectSidebar (Codex session list)", () => {
  it("renders branches grouped into today / yesterday / earlier buckets", () => {
    render(
      <ProjectSidebar
        sidebarProjects={TEST_PROJECTS}
        activeProjectId="commercial"
        activeConversationId="all"
        activeProjectTitle="商业图库项目"
        onSelectProject={vi.fn()}
        onSelectConversation={vi.fn()}
      />
    );

    const today = screen.getByTestId("session-bucket-today");
    expect(within(today).getByText("今天")).toBeInTheDocument();
    expect(within(today).getByText(/今天的会话标题/)).toBeInTheDocument();

    const yesterday = screen.getByTestId("session-bucket-yesterday");
    expect(within(yesterday).getByText("昨天")).toBeInTheDocument();

    const earlier = screen.getByTestId("session-bucket-earlier");
    expect(within(earlier).getByText(/陈年老会话/)).toBeInTheDocument();

    // 没有 thisWeek 数据 —— bucket 不渲染
    expect(screen.queryByTestId("session-bucket-thisWeek")).not.toBeInTheDocument();
  });

  it("shows the active project in the header and other projects in the switcher", () => {
    render(
      <ProjectSidebar
        sidebarProjects={TEST_PROJECTS}
        activeProjectId="commercial"
        activeConversationId="all"
        activeProjectTitle="商业图库项目"
        onSelectProject={vi.fn()}
        onSelectConversation={vi.fn()}
      />
    );

    expect(screen.getByTestId("project-header-title")).toHaveTextContent(
      "商业图库项目"
    );
    const switchRows = screen.getAllByTestId("project-switch-row");
    expect(switchRows).toHaveLength(1);
    expect(switchRows[0]).toHaveTextContent("社媒内容项目");
  });

  it("calls onSelectProject when a switcher row is clicked", () => {
    const onSelectProject = vi.fn();
    render(
      <ProjectSidebar
        sidebarProjects={TEST_PROJECTS}
        activeProjectId="commercial"
        activeConversationId="all"
        activeProjectTitle="商业图库项目"
        onSelectProject={onSelectProject}
        onSelectConversation={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("project-switch-row"));
    expect(onSelectProject).toHaveBeenCalledWith("social");
  });

  it("shows an empty hint when the active project has no sessions", () => {
    render(
      <ProjectSidebar
        sidebarProjects={TEST_PROJECTS}
        activeProjectId="social"
        activeConversationId="all"
        activeProjectTitle="社媒内容项目"
        onSelectProject={vi.fn()}
        onSelectConversation={vi.fn()}
      />
    );

    expect(screen.getByTestId("session-list-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("session-bucket-today")).not.toBeInTheDocument();
  });

  it("invokes onPlaceholderAction for the kebab and new-project buttons", () => {
    const onPlaceholderAction = vi.fn();
    render(
      <ProjectSidebar
        sidebarProjects={TEST_PROJECTS}
        activeProjectId="commercial"
        activeConversationId="all"
        activeProjectTitle="商业图库项目"
        onSelectProject={vi.fn()}
        onSelectConversation={vi.fn()}
        onPlaceholderAction={onPlaceholderAction}
      />
    );

    fireEvent.click(screen.getByTestId("project-kebab-button"));
    expect(onPlaceholderAction).toHaveBeenCalledWith("project-kebab");

    fireEvent.click(screen.getByTestId("new-project-button"));
    expect(onPlaceholderAction).toHaveBeenCalledWith("new-project");
  });
});
