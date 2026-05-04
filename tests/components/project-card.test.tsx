import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectCard from "@/components/creator/studio/ProjectCard";
import { SidebarToastProvider } from "@/components/creator/studio/SidebarToast";
import type {
  SidebarProjectBranchSummary,
  SidebarProjectGroup
} from "@/lib/creator/projects";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";

/**
 * ProjectCard 单测（plan slug clever-swimming-pumpkin · Cut 2）。
 *
 * 覆盖 5 条 invariant：
 * 1. 折叠时不渲染 session 区
 * 2. 展开时按 4 桶渲染（这里只测 today + earlier 因为构造数据简单）
 * 3. active 卡 header 高亮（aria-expanded + data-active 属性）
 * 4. 点 header 触发 onToggleCollapse；不触发 onSelectProject
 * 5. 点 session row 同时触发 onSelectProject + onSelectConversation
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
const longAgoIso = "2024-01-01T08:00:00";

const TEST_GROUP: SidebarProjectGroup = {
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
    makeBranch("branch-old", "陈年老会话", longAgoIso)
  ]
};

function renderCard(overrides: Partial<React.ComponentProps<typeof ProjectCard>> = {}) {
  const props: React.ComponentProps<typeof ProjectCard> = {
    group: TEST_GROUP,
    isActive: true,
    isCollapsed: false,
    activeConversationId: "all",
    activeProjectId: "commercial",
    onToggleCollapse: vi.fn(),
    onSelectProject: vi.fn(),
    onSelectConversation: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onKebabPlaceholder: vi.fn(),
    ...overrides
  };
  return {
    props,
    ...render(
      <SidebarToastProvider>
        <ProjectCard {...props} />
      </SidebarToastProvider>
    )
  };
}

describe("ProjectCard", () => {
  it("does not render any session content when collapsed", () => {
    renderCard({ isCollapsed: true });

    expect(screen.queryByTestId("session-bucket-today")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-bucket-earlier")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("conversation-row-all-commercial")
    ).not.toBeInTheDocument();
    // header 仍然在
    expect(screen.getByTestId("project-card-commercial")).toHaveAttribute(
      "data-collapsed",
      "true"
    );
  });

  it("renders today + earlier buckets and the all-conversation row when expanded", () => {
    renderCard({ isCollapsed: false });

    const today = screen.getByTestId("session-bucket-today");
    expect(within(today).getByText(/今天的会话标题/)).toBeInTheDocument();

    const earlier = screen.getByTestId("session-bucket-earlier");
    expect(within(earlier).getByText(/陈年老会话/)).toBeInTheDocument();

    expect(
      screen.getByTestId("conversation-row-all-commercial")
    ).toBeInTheDocument();
  });

  it("highlights the card header when active and expanded", () => {
    renderCard({ isActive: true, isCollapsed: false });

    const card = screen.getByTestId("project-card-commercial");
    expect(card).toHaveAttribute("data-active", "true");
    expect(card).toHaveAttribute("data-collapsed", "false");
    const header = screen.getByTestId("project-card-header-commercial");
    expect(header).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles collapse when the header is clicked, without changing active project", () => {
    const { props } = renderCard({ isCollapsed: true });

    fireEvent.click(screen.getByTestId("project-card-header-commercial"));

    expect(props.onToggleCollapse).toHaveBeenCalledTimes(1);
    expect(props.onSelectProject).not.toHaveBeenCalled();
    expect(props.onSelectConversation).not.toHaveBeenCalled();
  });

  it("calls both onSelectProject and onSelectConversation when a session row is clicked", () => {
    const { props } = renderCard({
      isActive: false,
      isCollapsed: false,
      activeProjectId: "social"
    });

    const branchButtons = screen.getAllByTestId("conversation-row-branch");
    fireEvent.click(branchButtons[0]);

    expect(props.onSelectProject).toHaveBeenCalledWith("commercial");
    expect(props.onSelectConversation).toHaveBeenCalled();
    const lastConversationCall = vi
      .mocked(props.onSelectConversation)
      .mock.calls.at(-1);
    expect(lastConversationCall?.[0]).toMatch(/^branch:/);
  });

  it("does not bubble kebab menu clicks to the header collapse toggle", () => {
    const { props } = renderCard({ isCollapsed: false });

    // kebab trigger 是 ProjectKebabMenu 的 trigger button；点它（含
    // 它接收的 click 事件）不应冒到 header，否则 header 的 toggle 会被
    // 误触发。
    fireEvent.click(screen.getByTestId("project-kebab-button"));
    expect(props.onToggleCollapse).not.toHaveBeenCalled();
  });

  it("starts a new conversation in this project when the + button is clicked", () => {
    const { props } = renderCard({ isActive: false, isCollapsed: true });

    fireEvent.click(
      screen.getByTestId("project-card-new-conversation-commercial")
    );

    expect(props.onSelectProject).toHaveBeenCalledWith("commercial");
    expect(props.onSelectConversation).toHaveBeenCalledWith("new");
    // 不应冒到 header 触发 toggle
    expect(props.onToggleCollapse).not.toHaveBeenCalled();
  });
});
