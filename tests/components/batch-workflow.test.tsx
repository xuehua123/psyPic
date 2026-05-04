import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BatchWorkflowPanel from "@/components/creator/BatchWorkflowPanel";
import { BatchProvider } from "@/components/creator/studio/BatchContext";

function renderPanel(defaultSize = "1024x1024") {
  return render(
    <BatchProvider defaultSize={defaultSize}>
      <BatchWorkflowPanel />
    </BatchProvider>
  );
}

describe("BatchWorkflowPanel", () => {
  it("submits batch prompts and renders queued items", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            batch_id: "batch_123",
            status: "queued",
            items: [
              {
                item_id: "batch_item_1",
                task_id: "task_1",
                prompt: "香水主图",
                size: "1024x1024",
                status: "queued",
                retry_count: 0
              }
            ]
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    renderPanel();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("批量 Prompt"), "香水主图\n口红主图");
    await user.click(screen.getByRole("button", { name: "创建批量任务" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/batches",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: expect.stringContaining("香水主图")
      })
    );
    expect(await screen.findByText("batch_123")).toBeInTheDocument();
    expect(screen.getByText("香水主图")).toBeInTheDocument();
    expect(screen.getByText("queued")).toBeInTheDocument();
  });

  it("accepts CSV import text", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { batch_id: "batch_csv", items: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    renderPanel();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "CSV" }));
    await user.type(
      screen.getByLabelText("CSV 内容"),
      "prompt,size\n香水主图,1024x1024"
    );
    await user.click(screen.getByRole("button", { name: "创建批量任务" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/batches",
      expect.objectContaining({
        body: expect.stringContaining('"csv"')
      })
    );
  });

  it("throws when used without BatchProvider", () => {
    // 关闭 React 的 error 噪音
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BatchWorkflowPanel />)).toThrow(
      /useBatch must be used within a <BatchProvider>/
    );
    errorSpy.mockRestore();
  });

  it("shares state across multiple panel mounts under one provider", async () => {
    // 验证 BatchProvider 让桌面 Inspector + 移动端底抽屉同时挂载同一份
    // BatchWorkflowPanel 时共享 state（mode / promptText）。
    render(
      <BatchProvider defaultSize="1024x1024">
        <div data-testid="desktop">
          <BatchWorkflowPanel />
        </div>
        <div data-testid="mobile">
          <BatchWorkflowPanel />
        </div>
      </BatchProvider>
    );

    const user = userEvent.setup();
    const desktopTabs = screen.getByTestId("desktop");
    // 在桌面切到 CSV 模式
    const csvTabInDesktop = desktopTabs.querySelector(
      '[role="tab"][aria-selected="false"]'
    ) as HTMLElement | null;
    expect(csvTabInDesktop).not.toBeNull();
    await user.click(csvTabInDesktop!);

    // 移动那份也应该跟着切到 CSV（aria-selected=true 在 CSV tab 上）
    const mobileTabs = screen
      .getByTestId("mobile")
      .querySelectorAll('[role="tab"]');
    const mobileSelected = Array.from(mobileTabs).find(
      (tab) => tab.getAttribute("aria-selected") === "true"
    );
    expect(mobileSelected?.textContent).toBe("CSV");
  });
});
