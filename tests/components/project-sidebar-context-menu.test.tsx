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
});
