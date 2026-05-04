import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ProjectSidebar from "@/components/creator/studio/ProjectSidebar";
import type { SidebarProjectGroup } from "@/lib/creator/projects";

/**
 * Cut 5 验收：项目 CRUD UI（kebab DropdownMenu + 3 dialog + toast 占位）。
 * 不直接打 IndexedDB —— callback spy 验证调用，dialog state 自闭。
 */

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
    branchSummaries: []
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

function makeProps(overrides: Partial<React.ComponentProps<typeof ProjectSidebar>> = {}) {
  return {
    sidebarProjects: TEST_PROJECTS,
    activeProjectId: "commercial" as const,
    activeConversationId: "all" as const,
    activeProjectTitle: "商业图库项目",
    onSelectProject: vi.fn(),
    onSelectConversation: vi.fn(),
    onCreateProject: vi.fn(async () => {}),
    onRenameProject: vi.fn(async () => {}),
    onDeleteProject: vi.fn(async () => {}),
    ...overrides
  };
}

describe("ProjectSidebar CRUD UI", () => {
  it("creates a project via the new-project dialog", async () => {
    const onCreateProject = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<ProjectSidebar {...makeProps({ onCreateProject })} />);

    await user.click(screen.getByTestId("new-project-button"));
    const dialog = screen.getByTestId("new-project-dialog");

    await user.type(within(dialog).getByTestId("new-project-title-input"), "活动 5 月");
    await user.click(within(dialog).getByTestId("new-project-submit"));

    expect(onCreateProject).toHaveBeenCalledWith("活动 5 月");
    // dialog 关闭
    expect(screen.queryByTestId("new-project-dialog")).not.toBeInTheDocument();
  });

  it("renames the active project via the rename dialog", async () => {
    const onRenameProject = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<ProjectSidebar {...makeProps({ onRenameProject })} />);

    await user.click(screen.getByTestId("project-kebab-button"));
    await user.click(await screen.findByTestId("project-kebab-rename"));

    const dialog = await screen.findByTestId("project-rename-dialog");
    const input = within(dialog).getByTestId("project-rename-input");
    await user.clear(input);
    await user.type(input, "商业图库 · 改名版");
    await user.click(within(dialog).getByTestId("project-rename-submit"));

    expect(onRenameProject).toHaveBeenCalledWith("commercial", "商业图库 · 改名版");
  });

  it("deletes the active project via the delete alert", async () => {
    const onDeleteProject = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<ProjectSidebar {...makeProps({ onDeleteProject })} />);

    await user.click(screen.getByTestId("project-kebab-button"));
    await user.click(await screen.findByTestId("project-kebab-delete"));

    const alert = await screen.findByTestId("project-delete-alert");
    await user.click(within(alert).getByTestId("project-delete-confirm"));

    expect(onDeleteProject).toHaveBeenCalledWith("commercial");
  });

  it("disables the delete button when only one project remains", async () => {
    const onDeleteProject = vi.fn(async () => {});
    const user = userEvent.setup();
    render(
      <ProjectSidebar
        {...makeProps({ onDeleteProject })}
        sidebarProjects={[TEST_PROJECTS[0]]}
      />
    );

    await user.click(screen.getByTestId("project-kebab-button"));
    await user.click(await screen.findByTestId("project-kebab-delete"));

    const alert = await screen.findByTestId("project-delete-alert");
    const confirm = within(alert).getByTestId("project-delete-confirm");
    expect(confirm).toBeDisabled();

    fireEvent.click(confirm);
    expect(onDeleteProject).not.toHaveBeenCalled();
  });

  it("shows a placeholder toast for not-yet-implemented kebab items", async () => {
    const user = userEvent.setup();
    render(<ProjectSidebar {...makeProps()} />);

    await user.click(screen.getByTestId("project-kebab-button"));
    await user.click(await screen.findByTestId("project-kebab-pin"));

    const region = await screen.findByTestId("sidebar-toast-region");
    expect(within(region).getByText(/固定项目.*即将上线/)).toBeInTheDocument();
  });
});
