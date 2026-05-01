import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BatchWorkflowPanel from "@/components/creator/BatchWorkflowPanel";

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

    render(<BatchWorkflowPanel defaultSize="1024x1024" />);

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

    render(<BatchWorkflowPanel defaultSize="1024x1024" />);

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
});
