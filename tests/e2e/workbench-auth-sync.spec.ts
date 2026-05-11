import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe.configure({ mode: "serial" });

const testUser = {
  email: `e2e-workbench-${Date.now()}@example.com`,
  password: "Password123!"
};

async function bindE2ESession(page: Page, role: "admin" | "user") {
  const response = await page.request.post("/api/e2e/session", {
    data: { role },
    headers: { "x-psypic-e2e-token": "e2e" }
  });
  const body = await response.json();

  expect(response.ok()).toBeTruthy();
  
  const currentUrl = page.url();
  let urlObj;
  if (currentUrl.startsWith("http://") || currentUrl.startsWith("https://")) {
    urlObj = new URL(currentUrl);
  } else {
    urlObj = new URL(`http://127.0.0.1:${process.env.PSYPIC_E2E_PORT ?? 3200}`);
  }

  await page.context().addCookies([
    {
      name: "psypic_session",
      value: body.data.session_id,
      url: urlObj.origin,
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

async function readFakeSub2APIBaseUrl() {
  const file = await readFile(
    path.join(process.cwd(), "output", "playwright", "fake-sub2api.json"),
    "utf8"
  );
  return (JSON.parse(file) as { baseUrl: string }).baseUrl;
}

test("1. auth-gated empty states, login, logout, and manual key binding", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByText("未登录").first()).toBeVisible();
  await expect(page.getByText("登录以使用云端项目同步与 API 商业生图额度")).toBeVisible();
  await page.screenshot({ path: `output/playwright/screenshots/unauthenticated-${isMobile ? 'mobile' : 'desktop'}.png` });

  // Check login dialog opens
  await page.getByRole("button", { name: "登录 / 注册" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Actually log in via E2E API to bypass DB requirement
  await bindE2ESession(page, "user");
  await page.reload();

  // Test logout
  await page.getByRole("button", { name: /登出|退出/ }).click();
  await expect(page.getByText("未登录").first()).toBeVisible();

  // Login again to test manual key binding
  await bindE2ESession(page, "user");
  await page.goto("/settings");

  // 绑定 Manual Key
  const baseUrl = await readFakeSub2APIBaseUrl();
  await page.getByLabel("Sub2API Base URL").fill(baseUrl);
  await page.getByLabel("API Key").fill("e2e-workbench-key");
  await page.getByRole("button", { name: "保存到 BFF" }).click();
  await expect(page.getByText("已通过 BFF 建立 key binding。")).toBeVisible();
});

test("2. project & session CRUD, labels, and fallback", async ({ page, isMobile }) => {
  // Login directly via API
  await bindE2ESession(page, "user");
  await page.goto("/");
  await expect(page.getByText("新对话")).toBeVisible();

  // Create Project
  if (isMobile) {
    await page.getByRole("button", { name: "打开项目侧边栏" }).click();
  }
  await page.getByRole("button", { name: "新建项目" }).click();
  
  const projectTitleInput = page.getByRole("textbox", { name: "项目名称" });
  await projectTitleInput.fill("E2E Workbench Project");
  await projectTitleInput.press("Enter");
  
  // Wait for dialog to disappear so we know it finished creating
  await expect(page.getByTestId("new-project-dialog")).not.toBeVisible();
  
  if (isMobile) {
    // Reopen sidebar just in case, though it usually stays open.
    const sidebarBtn = page.getByRole("button", { name: "打开项目侧边栏" });
    if (await sidebarBtn.isVisible()) {
      await sidebarBtn.click();
    }
  }

  await expect(page.getByText("E2E Workbench Project", { exact: true }).filter({ visible: true }).first()).toBeVisible();

  // Create Session
  await page.getByRole("button", { name: "新建对话" }).first().click();
  // It should show up in the project
  
  if (isMobile) {
    // Creating a session closes the sidebar on mobile, so we must reopen it.
    const sidebarBtn = page.getByRole("button", { name: "打开项目侧边栏" });
    if (await sidebarBtn.isVisible()) {
      await sidebarBtn.click();
    }
  }

  // Wait for session title to be in the sidebar (default name is "新对话" or similar).
  // Actually, we can just try renaming the project first.
  
  const sidebar = isMobile ? page.locator('[data-mobile-drawer="sidebar"]') : page.locator('[data-testid="chat-studio-shell"] > .project-sidebar');
  const createdProject = sidebar.locator('[data-testid^="project-card-header-"]').filter({ hasText: "E2E Workbench Project" }).first();
  await createdProject.getByTestId("project-kebab-button").click();
  await page.getByRole("menuitem", { name: "重命名项目" }).click();
  await page.getByRole("textbox", { name: "项目名称" }).fill("E2E Renamed Project");
  await page.getByRole("textbox", { name: "项目名称" }).press("Enter");
  await expect(page.getByTestId("project-rename-dialog")).not.toBeVisible();
  
  // Close the DropdownMenu that was left open by event.preventDefault() in onSelect
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).not.toBeVisible();

  await expect(sidebar.getByText("E2E Renamed Project", { exact: true }).first()).toBeVisible();

  // Delete project
  const renamedProject = sidebar.locator('[data-testid^="project-card-header-"]').filter({ hasText: "E2E Renamed Project" }).first();
  await renamedProject.getByTestId("project-kebab-button").click();
  await page.getByRole("menuitem", { name: "移除" }).click();
  // Click confirm on the alert dialog
  await page.getByTestId("project-delete-confirm").click();
  await expect(page.getByTestId("project-delete-alert")).not.toBeVisible();
  
  // wait for it to disappear
  await expect(sidebar.getByText("E2E Renamed Project", { exact: true }).first()).not.toBeVisible();

  // Fallback mode test
  // Intercept the API to simulate 503
  await page.route("**/api/workbench/projects*", async route => {
    await route.fulfill({
      status: 503,
      headers: { "Retry-After": "30" },
      json: { error: { code: "fallback_503", message: "Workbench unavailable" } }
    });
  });

  await page.reload();
  await expect(page.getByText("本地离线模式：云端同步不可用")).toBeVisible();
  await page.screenshot({ path: `output/playwright/screenshots/fallback-${isMobile ? 'mobile' : 'desktop'}.png` });

  await page.unroute("**/api/workbench/projects*");
});
