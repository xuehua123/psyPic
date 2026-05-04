import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ProjectSidebar from "@/components/creator/studio/ProjectSidebar";
import type { SidebarProjectGroup } from "@/lib/creator/projects";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";

/**
 * Cut 6 验收：会话级菜单 —— 复制 ID / 复制深度链接 / 占位 toast。
 *
 * 用 dropdown trigger（hover/mobile 三点按钮）触发 DropdownMenu，避开
 * Radix ContextMenu 在 jsdom 里对真实 contextmenu 事件的脆性。两个菜单
 * 共用同一组 handler，行为等价。
 *
 * `navigator.clipboard` 由 @testing-library/user-event 在 `userEvent.setup()`
 * 内部装上（jsdom 默认没有）。所以 spy 必须在 setup() **之后** 拿，否则
 * `vi.spyOn(navigator.clipboard, "writeText")` 会因为 clipboard 不存在而抛
 * "could not find an object to spy upon"。
 */

function makeBranch(id: string, prompt: string, iso: string) {
  return {
    id,
    label: "主线",
    count: 1,
    latestNode: {
      id: `node_${id}`,
      parentId: null,
      branchId: id,
      branchLabel: "主线",
      depth: 0,
      createdAt: iso,
      status: "succeeded",
      prompt,
      params: {} as CreatorVersionNode["params"],
      images: [],
      source: "generation"
    } as CreatorVersionNode
  };
}

const TEST_PROJECTS: SidebarProjectGroup[] = [
  {
    project: {
      id: "commercial",
      title: "商业图库项目",
      description: "默认项目",
      emptyTitle: "商业",
      emptyDescription: "测试。"
    },
    nodes: [],
    branchSummaries: [makeBranch("br_test_1", "今天的会话", new Date().toISOString())]
  }
];

const baseProps = {
  sidebarProjects: TEST_PROJECTS,
  activeProjectId: "commercial" as const,
  activeConversationId: "all" as const,
  activeProjectTitle: "商业图库项目",
  onSelectProject: vi.fn(),
  onSelectConversation: vi.fn(),
  onCreateProject: vi.fn(async () => {}),
  onRenameProject: vi.fn(async () => {}),
  onDeleteProject: vi.fn(async () => {})
};

function setupClipboardSpy() {
  const user = userEvent.setup();
  const writeText = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockImplementation(async () => {});
  return { user, writeText };
}

describe("Session row menu (Cut 6)", () => {
  it("copies the session ID via 复制会话 ID", async () => {
    const { user, writeText } = setupClipboardSpy();
    render(<ProjectSidebar {...baseProps} />);

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-copy-id"));

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(within(region).getByText("会话 ID 已复制")).toBeInTheDocument();

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("br_test_1")
    );
    writeText.mockRestore();
  });

  it("copies a deep link containing project + conversation parameters", async () => {
    const { user, writeText } = setupClipboardSpy();
    render(<ProjectSidebar {...baseProps} />);

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-copy-link"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const link = writeText.mock.calls[0][0] as string;
    expect(link).toMatch(/project=commercial/);
    expect(link).toMatch(/conversation=branch:br_test_1/);

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(within(region).getByText("深度链接已复制")).toBeInTheDocument();
    writeText.mockRestore();
  });

  it("shows a placeholder toast for not-yet-implemented session actions", async () => {
    const { user, writeText } = setupClipboardSpy();
    render(<ProjectSidebar {...baseProps} />);

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-pin"));

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(within(region).getByText(/置顶对话.*即将上线/)).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    writeText.mockRestore();
  });

  it("calls onForkSession with the project id and branch when 「分叉到同一工作树」 is clicked", async () => {
    const onForkSession = vi.fn();
    const user = userEvent.setup();
    render(<ProjectSidebar {...baseProps} onForkSession={onForkSession} />);

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-fork-same"));

    expect(onForkSession).toHaveBeenCalledTimes(1);
    const [projectId, branch] = onForkSession.mock.calls[0];
    expect(projectId).toBe("commercial");
    expect(branch).toMatchObject({ id: "br_test_1" });
  });

  it("calls onDeriveSession with the project id and branch when 「派生到新工作树」 is clicked", async () => {
    const onDeriveSession = vi.fn();
    const user = userEvent.setup();
    render(<ProjectSidebar {...baseProps} onDeriveSession={onDeriveSession} />);

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-fork-new"));

    expect(onDeriveSession).toHaveBeenCalledTimes(1);
    const [projectId, branch] = onDeriveSession.mock.calls[0];
    expect(projectId).toBe("commercial");
    expect(branch).toMatchObject({ id: "br_test_1" });
  });

  it("falls back to placeholder toast for fork items when handlers are not provided", async () => {
    const user = userEvent.setup();
    render(<ProjectSidebar {...baseProps} />);

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-fork-same"));

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(
      within(region).getByText(/分叉到同一工作树.*桌面端功能/)
    ).toBeInTheDocument();
  });

  it("calls onTogglePinSession with the project id and branch when 「置顶对话」 is clicked", async () => {
    const onTogglePinSession = vi.fn();
    const user = userEvent.setup();
    render(
      <ProjectSidebar
        {...baseProps}
        onTogglePinSession={onTogglePinSession}
      />
    );

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-pin"));

    expect(onTogglePinSession).toHaveBeenCalledTimes(1);
    const [projectId, branch] = onTogglePinSession.mock.calls[0];
    expect(projectId).toBe("commercial");
    expect(branch).toMatchObject({ id: "br_test_1" });

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(within(region).getByText("已置顶对话")).toBeInTheDocument();
  });

  it("renders 「取消置顶」 label and toast when the branch is already pinned", async () => {
    const onTogglePinSession = vi.fn();
    const pinnedBranch = {
      ...TEST_PROJECTS[0].branchSummaries[0],
      isPinned: true
    };
    const projectsWithPinned = [
      {
        ...TEST_PROJECTS[0],
        branchSummaries: [pinnedBranch]
      }
    ];
    const user = userEvent.setup();
    render(
      <ProjectSidebar
        {...baseProps}
        onTogglePinSession={onTogglePinSession}
        sidebarProjects={projectsWithPinned}
      />
    );

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-pin"));

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(within(region).getByText("已取消置顶")).toBeInTheDocument();
  });

  it("opens the SessionRenameDialog and submits a new label via 「重命名对话」", async () => {
    const onRenameSession = vi.fn();
    const user = userEvent.setup();
    render(
      <ProjectSidebar
        {...baseProps}
        onRenameSession={onRenameSession}
      />
    );

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-rename"));

    const dialog = await screen.findByTestId("session-rename-dialog");
    const input = within(dialog).getByTestId("session-rename-input");
    await user.clear(input);
    await user.type(input, "我的新标题");
    await user.click(within(dialog).getByTestId("session-rename-submit"));

    expect(onRenameSession).toHaveBeenCalledTimes(1);
    const [projectId, branch, label] = onRenameSession.mock.calls[0];
    expect(projectId).toBe("commercial");
    expect(branch).toMatchObject({ id: "br_test_1" });
    expect(label).toBe("我的新标题");

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(within(region).getByText("已重命名")).toBeInTheDocument();
  });

  it("renders the custom label when a branch has one", () => {
    const labeledProjects = [
      {
        ...TEST_PROJECTS[0],
        branchSummaries: [
          {
            ...TEST_PROJECTS[0].branchSummaries[0],
            customLabel: "我的自定义会话"
          }
        ]
      }
    ];
    render(
      <ProjectSidebar {...baseProps} sidebarProjects={labeledProjects} />
    );

    expect(screen.getByText("我的自定义会话")).toBeInTheDocument();
    expect(screen.queryByText("今天的会话")).not.toBeInTheDocument();
  });

  it("calls onToggleArchiveSession with toast and hides archived branches by default", async () => {
    const onToggleArchiveSession = vi.fn();
    const user = userEvent.setup();
    render(
      <ProjectSidebar
        {...baseProps}
        onToggleArchiveSession={onToggleArchiveSession}
      />
    );

    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-archive"));

    expect(onToggleArchiveSession).toHaveBeenCalledTimes(1);
    const [projectId, branch] = onToggleArchiveSession.mock.calls[0];
    expect(projectId).toBe("commercial");
    expect(branch).toMatchObject({ id: "br_test_1" });

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(within(region).getByText("已归档对话")).toBeInTheDocument();
  });

  it("hides archived branches by default and reveals them via 「显示归档」 toggle", async () => {
    const archivedBranch = {
      ...TEST_PROJECTS[0].branchSummaries[0],
      isArchived: true
    };
    const archivedProjects = [
      {
        ...TEST_PROJECTS[0],
        branchSummaries: [archivedBranch]
      }
    ];
    const user = userEvent.setup();
    render(
      <ProjectSidebar {...baseProps} sidebarProjects={archivedProjects} />
    );

    // 默认隐藏：会话标题不可见
    expect(screen.queryByText("今天的会话")).not.toBeInTheDocument();

    // 「显示归档（1）」可见
    const toggle = screen.getByTestId("toggle-archived-commercial");
    expect(toggle).toHaveTextContent("显示归档（1）");

    await user.click(toggle);
    expect(screen.getByText("今天的会话")).toBeInTheDocument();
    expect(toggle).toHaveTextContent("隐藏归档");
  });

  it("renders 「恢复对话」 label and toast when the branch is already archived", async () => {
    const onToggleArchiveSession = vi.fn();
    const archivedBranch = {
      ...TEST_PROJECTS[0].branchSummaries[0],
      isArchived: true
    };
    const archivedProjects = [
      {
        ...TEST_PROJECTS[0],
        branchSummaries: [archivedBranch]
      }
    ];
    const user = userEvent.setup();
    render(
      <ProjectSidebar
        {...baseProps}
        onToggleArchiveSession={onToggleArchiveSession}
        sidebarProjects={archivedProjects}
      />
    );

    // 必须先打开归档区才能点到 row 的 menu
    await user.click(screen.getByTestId("toggle-archived-commercial"));
    await user.click(screen.getByTestId("session-row-menu-button"));
    await user.click(await screen.findByTestId("session-menu-archive"));

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(within(region).getByText("已恢复对话")).toBeInTheDocument();
  });
});
