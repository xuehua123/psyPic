import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import SessionRenameDialog from "@/components/creator/studio/SessionRenameDialog";

/**
 * Cut 3 验收：会话重命名 Dialog 的 form 行为。
 * 重命名 store 写入由 hook 单测覆盖；这里只验 form 的 trim / disabled /
 * submit / cancel / 留空恢复默认。
 */
describe("SessionRenameDialog", () => {
  it("starts with the initial title prefilled", () => {
    render(
      <SessionRenameDialog
        initialTitle="原标题"
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
      />
    );
    expect(screen.getByTestId("session-rename-input")).toHaveValue("原标题");
    expect(screen.getByTestId("session-rename-submit")).toBeDisabled();
  });

  it("submits the trimmed new title and closes", async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionRenameDialog
        initialTitle="原标题"
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        open
      />
    );

    const input = screen.getByTestId("session-rename-input");
    await user.clear(input);
    await user.type(input, "  我的新标题  ");
    await user.click(screen.getByTestId("session-rename-submit"));

    expect(onSubmit).toHaveBeenCalledWith("我的新标题");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits empty string when the field is cleared (恢复默认)", async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionRenameDialog
        initialTitle="自定义标题"
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        open
      />
    );

    const input = screen.getByTestId("session-rename-input");
    await user.clear(input);
    await user.click(screen.getByTestId("session-rename-submit"));

    expect(onSubmit).toHaveBeenCalledWith("");
  });
});
