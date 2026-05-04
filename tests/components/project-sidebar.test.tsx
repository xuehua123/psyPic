import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectSidebar from "@/components/creator/studio/ProjectSidebar";
import type {
  SidebarProjectBranchSummary,
  SidebarProjectGroup
} from "@/lib/creator/projects";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";

/**
 * 重写于 plan slug clever-swimming-pumpkin · Cut 3 —— 平铺折叠卡 sidebar
 * 主体的 invariant：
 * - 所有项目都渲染成 ProjectCard（不再只看一个 active）
 * - active project 默认展开（卡内 4 桶可见）
 * - 非 active project 默认折叠
 * - 点 active 之外的卡 header → 该卡展开（不切 active project）
 * - 点折叠卡 → 仍折叠的卡里看不到 session
 * - 点折叠卡内的 session 行触发 onSelectProject + onSelectConversation
 * - 「+ 新建项目」打开 NewProjectDialog
 *
 * localStorage 持久化的覆盖在 tests/unit/use-collapsed-projects.test.ts。
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

beforeEach(() => {
  // 清掉 useCollapsedProjects 的 localStorage，避免用例间串
  window.localStorage.clear();
});

describe("ProjectSidebar (flat collapsible cards)", () => {
  it("renders every project as a ProjectCard", () => {
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

    expect(screen.getByTestId("project-card-commercial")).toBeInTheDocument();
    expect(screen.getByTestId("project-card-social")).toBeInTheDocument();
  });

  it("expands the active project by default and collapses the others", () => {
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

    expect(screen.getByTestId("project-card-commercial")).toHaveAttribute(
      "data-collapsed",
      "false"
    );
    expect(screen.getByTestId("project-card-social")).toHaveAttribute(
      "data-collapsed",
      "true"
    );

    // active 卡内可见 4 桶；折叠卡看不到「全部对话」
    expect(screen.getByTestId("session-bucket-today")).toBeInTheDocument();
    expect(
      screen.queryByTestId("conversation-row-all-social")
    ).not.toBeInTheDocument();
  });

  it("toggles a non-active card open without changing the active project", () => {
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

    const socialHeader = screen.getByTestId("project-card-header-social");
    fireEvent.click(socialHeader);

    // social 卡展开了，commercial 仍然展开（不互斥）
    expect(screen.getByTestId("project-card-social")).toHaveAttribute(
      "data-collapsed",
      "false"
    );
    expect(screen.getByTestId("project-card-commercial")).toHaveAttribute(
      "data-collapsed",
      "false"
    );
    // active project 没切
    expect(onSelectProject).not.toHaveBeenCalled();
  });

  it("groups branches into today / yesterday / earlier buckets within the active card", () => {
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
    expect(within(today).getByText(/今天的会话标题/)).toBeInTheDocument();

    const yesterday = screen.getByTestId("session-bucket-yesterday");
    expect(within(yesterday).getByText(/昨天的会话/)).toBeInTheDocument();

    const earlier = screen.getByTestId("session-bucket-earlier");
    expect(within(earlier).getByText(/陈年老会话/)).toBeInTheDocument();

    // 没有 thisWeek 数据 —— bucket 不渲染
    expect(screen.queryByTestId("session-bucket-thisWeek")).not.toBeInTheDocument();
  });

  it("clicking a branch row in the active card calls onSelectConversation", () => {
    const onSelectConversation = vi.fn();
    render(
      <ProjectSidebar
        sidebarProjects={TEST_PROJECTS}
        activeProjectId="commercial"
        activeConversationId="all"
        activeProjectTitle="商业图库项目"
        onSelectProject={vi.fn()}
        onSelectConversation={onSelectConversation}
      />
    );

    const branchButtons = screen.getAllByTestId("conversation-row-branch");
    fireEvent.click(branchButtons[0]);

    expect(onSelectConversation).toHaveBeenCalled();
    const call = onSelectConversation.mock.calls.at(-1);
    expect(call?.[0]).toMatch(/^branch:/);
  });

  it("opens the new-project dialog when 「+ 新建项目」 is clicked", () => {
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

    fireEvent.click(screen.getByTestId("new-project-button"));
    expect(screen.getByTestId("new-project-dialog")).toBeInTheDocument();
  });
});
