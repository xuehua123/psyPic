import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AppShell from "@/components/layout/AppShell";

describe("AppShell", () => {
  it("renders the PsyPic brand and the spec-mandated minimal main navigation", () => {
    render(
      <AppShell currentPath="/community">
        <div>Community content</div>
      </AppShell>
    );

    // Brand is always present
    expect(screen.getByText("PsyPic")).toBeInTheDocument();

    // Spec: main nav only contains 工作台 + 灵感社区
    expect(screen.getByRole("link", { name: /工作台/ })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.getByRole("link", { name: /灵感社区/ })).toHaveAttribute(
      "href",
      "/community"
    );

    // Active page highlighted
    expect(screen.getByRole("link", { name: /灵感社区/ })).toHaveAttribute(
      "aria-current",
      "page"
    );

    // Utility nav: settings always visible
    expect(screen.getByRole("link", { name: /设置/ })).toHaveAttribute(
      "href",
      "/settings"
    );
  });

  it("does NOT show 素材库/商业模板/任务队列 in the global navigation (spec compliance)", () => {
    render(
      <AppShell currentPath="/">
        <div>Workbench</div>
      </AppShell>
    );

    expect(screen.queryByRole("link", { name: /^素材库$/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^商业模板$/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^任务队列$/ })).toBeNull();
  });

  it("hides admin link by default and shows it when explicitly enabled", () => {
    const { rerender } = render(
      <AppShell currentPath="/community">
        <div>Community content</div>
      </AppShell>
    );

    expect(screen.queryByRole("link", { name: /管理台/ })).toBeNull();

    rerender(
      <AppShell currentPath="/admin" showAdminLink>
        <div>Admin content</div>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: /管理台/ })).toHaveAttribute(
      "href",
      "/admin"
    );
    expect(screen.getByRole("link", { name: /管理台/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("renders body content inside an app-shell test target", () => {
    render(
      <AppShell currentPath="/settings">
        <div data-testid="page-body-content">Body</div>
      </AppShell>
    );

    expect(screen.getByTestId("app-shell")).toContainElement(
      screen.getByTestId("page-body-content")
    );
  });
});
