import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";
import { getCurrentRequestViewer } from "@/server/services/request-user-service";

vi.mock("@/server/services/request-user-service", () => ({
  getCurrentRequestViewer: vi.fn()
}));

describe("AdminPage", () => {
  it("renders the unauthorized state inside the shared product shell and hides the admin utility link", async () => {
    vi.mocked(getCurrentRequestViewer).mockResolvedValue({
      isAdmin: false,
      session: null,
      user: null
    });

    render(await AdminPage());

    // Shared shell still renders brand + main nav
    expect(screen.getByText("PsyPic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /工作台/ })).toHaveAttribute(
      "href",
      "/"
    );

    // Unauthorized alert is presented
    expect(screen.getByRole("alert")).toHaveTextContent("需要管理员权限");

    // Spec compliance: admin link is NOT shown to non-admin users
    expect(screen.queryByRole("link", { name: /管理台/ })).toBeNull();
  });
});
