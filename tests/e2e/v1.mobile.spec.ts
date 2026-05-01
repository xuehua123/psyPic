import { expect, test, type Page } from "@playwright/test";

const e2eToken = "e2e";

test("移动端主流程页面可访问且关键控件不缺失", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "本地开发设置" })).toBeVisible();
  await expect(page.getByLabel("Sub2API Base URL")).toBeVisible();
  await expect(page.getByLabel("API Key")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("button", { name: "打开参数面板" })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成", exact: true })).toBeVisible();
  await expect(page.getByTestId("center-workspace")).toBeVisible();

  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "灵感社区" })).toBeVisible();
  await expect(page.getByLabel("社区筛选")).toBeVisible();

  await bindAdminSession(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "管理端" })).toBeVisible();
  await expect(page.getByLabel("最大生成数量")).toBeVisible();
});

async function bindAdminSession(page: Page) {
  const response = await page.request.post("/api/e2e/session", {
    data: { role: "admin" },
    headers: { "x-psypic-e2e-token": e2eToken }
  });
  const body = await response.json();

  expect(response.ok()).toBeTruthy();
  await page.context().addCookies([
    {
      name: "psypic_session",
      value: body.data.session_id,
      url: e2eBaseURL(page),
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

function e2eBaseURL(page: Page) {
  const currentUrl = page.url();

  if (currentUrl.startsWith("http://") || currentUrl.startsWith("https://")) {
    return new URL(currentUrl).origin;
  }

  return `http://127.0.0.1:${process.env.PSYPIC_E2E_PORT ?? 3200}`;
}
