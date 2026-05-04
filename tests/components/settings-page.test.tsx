import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";
import { isCurrentRequestAdmin } from "@/server/services/request-user-service";

vi.mock("@/server/services/request-user-service", () => ({
  isCurrentRequestAdmin: vi.fn()
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.mocked(isCurrentRequestAdmin).mockResolvedValue(false);
  });

  it("renders the settings page inside the global product shell", async () => {
    render(await SettingsPage());

    expect(screen.getByText("PsyPic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.queryByRole("link", { name: "返回创作台" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保存到 BFF/ })).toBeInTheDocument();
    expect(screen.getByText("本地开发设置")).toBeInTheDocument();
  });

  it("shows the admin utility entry for administrators before they visit the admin page", async () => {
    vi.mocked(isCurrentRequestAdmin).mockResolvedValue(true);

    render(await SettingsPage());

    expect(screen.getByRole("link", { name: "管理台" })).toHaveAttribute(
      "href",
      "/admin"
    );
  });
});
