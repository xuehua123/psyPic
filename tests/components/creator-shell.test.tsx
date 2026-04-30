import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
