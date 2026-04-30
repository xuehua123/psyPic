import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import CreatorWorkspace from "@/components/creator/CreatorWorkspace";

describe("CreatorWorkspace", () => {
  it("renders the v0.1 creator shell as the first screen", () => {
    render(<CreatorWorkspace />);

    expect(screen.getByTestId("left-parameter-panel")).toBeInTheDocument();
    expect(screen.getByTestId("center-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("right-history-panel")).toBeInTheDocument();
    expect(screen.getByTestId("commercial-template-list")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Prompt" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /生成图片/ })
    ).toBeInTheDocument();
    expect(screen.queryByText(/营销首页|hero/i)).not.toBeInTheDocument();
  });

  it("keeps advanced parameters collapsed by default", () => {
    render(<CreatorWorkspace />);

    expect(
      screen.getByRole("button", { name: /高级参数/ })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Moderation")).not.toBeInTheDocument();
  });

  it("provides a mobile bottom parameter panel entry", () => {
    render(<CreatorWorkspace />);

    expect(
      screen.getByRole("button", { name: "打开参数面板" })
    ).toBeInTheDocument();
  });

  it("submits text-to-image requests and renders result metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              task_id: "task_123",
              images: [
                {
                  asset_id: "asset_123",
                  url: "/api/assets/asset_123",
                  format: "png"
                }
              ],
              usage: {
                input_tokens: 10,
                output_tokens: 20,
                total_tokens: 30,
                estimated_cost: "0.0000"
              },
              duration_ms: 1200
            },
            request_id: "psypic_req_123",
            upstream_request_id: "upstream_req_123"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(await screen.findByText("asset_123")).toBeInTheDocument();
    expect(screen.getAllByText("psypic_req_123").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getAllByText(/30 tokens/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "下载" })).toHaveAttribute(
      "href",
      "/api/assets/asset_123"
    );
  });
});
