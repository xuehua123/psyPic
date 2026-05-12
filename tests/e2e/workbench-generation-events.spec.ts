import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe.configure({ mode: "serial" });

async function bindE2ESession(page: import("@playwright/test").Page, role: "admin" | "user") {
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

test("1. generation with workbench context and job runtime events", async ({ page, isMobile }) => {
  // Login and bind key via E2E API
  await bindE2ESession(page, "user");
  await page.goto("/settings");
  const baseUrl = await readFakeSub2APIBaseUrl();
  await page.getByLabel("Sub2API Base URL").fill(baseUrl);
  await page.getByLabel("API Key").fill("e2e-workbench-key");
  await page.getByRole("button", { name: "保存到 BFF" }).click();
  await expect(page.getByText("已通过 BFF 建立 key binding。")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("新对话")).toBeVisible();

  // Generate with workbench context
  const promptInput = page.getByTestId("center-workspace").getByLabel("Prompt", { exact: true });
  await promptInput.fill("E2E Workbench Context Generation");
  
  await page.getByRole("button", { name: "生成图片" }).click();
  
  // Wait for the task to complete
  await expect(page.getByRole("status", { name: "任务状态" })).toContainText("已完成");
  await expect(page.getByAltText("生成结果")).toBeVisible();

  // Check Task Dock events
  await expect(page.getByTestId("task-dock-section")).toBeVisible();
  await expect(page.getByTestId("task-dock-section")).toContainText("任务日志 (当前)");
  await expect(page.getByTestId("event-item-queued")).toBeVisible();
  await expect(page.getByTestId("event-item-running")).toBeVisible();
  await expect(page.getByTestId("event-item-succeeded")).toBeVisible();
  
  await page.screenshot({ path: `output/playwright/screenshots/task-dock-${isMobile ? 'mobile' : 'desktop'}.png` });

  // Since it generated an image, the session should be created and saved in the workbench
  if (isMobile) {
    await page.getByRole("button", { name: "打开项目" }).click();
  }
  
  // We should have a session node with the prompt we just typed
  await expect(page.getByText("E2E Workbench Context Generation").first()).toBeVisible();
});
