import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const e2eToken = "e2e";
const hiddenPrompt = "E2E 私密 Prompt 不应在社区详情泄露";
let publicWorkId = "";

test.describe.configure({ mode: "serial" });

test("一键导入 API 不返回明文 Key", async ({ request }) => {
  const response = await request.post("/api/import/exchange", {
    data: { import_code: "valid_one_time_code" }
  });
  const body = await response.json();

  expect(response.ok()).toBeTruthy();
  expect(body.data.session_bound).toBe(true);
  expect(JSON.stringify(body)).not.toContain("api_key");
  expect(JSON.stringify(body)).not.toContain("devkey");
});

test("工作台使用固定产品壳，页面本身不滚动", async ({ page }) => {
  await bindManualKey(page);

  await page.goto("/");
  await expectFixedProductShell(page);
  await expect(page.getByTestId("chat-studio-shell")).toBeVisible();
  await expect(page.getByTestId("chat-transcript")).toBeVisible();
});

test("创作台覆盖手动 key、文生图、图生图、遮罩、流式、批量、素材和社区发布", async ({
  page
}) => {
  await bindManualKey(page);

  await page.goto("/");
  await expectFixedProductShell(page);
  await expect(page.getByTestId("left-parameter-panel")).toBeVisible();
  await expect(page.getByTestId("center-workspace")).toBeVisible();
  await expect(page.getByTestId("right-history-panel")).toBeVisible();

  await expectConcurrencyLimit(page);

  await creatorPrompt(page).fill(hiddenPrompt);
  await page.getByRole("button", { name: "生成图片" }).click();
  await expect(page.getByRole("status", { name: "任务状态" })).toContainText("已完成");
  await expect(page.getByAltText("生成结果")).toBeVisible();
  await expect(page.getByText("30 tokens").first()).toBeVisible();

  await page.getByRole("button", { name: "作为参考图" }).click();
  await expect(page.getByTestId("reference-dropzone")).toContainText("1 张参考图");
  await page.getByRole("checkbox", { name: "遮罩编辑" }).check();
  await expect(page.getByLabel("遮罩画布")).toBeVisible();
  await page.getByRole("button", { name: "反选遮罩" }).click();
  await page.getByRole("button", { name: "生成图片" }).click();
  await expect(page.getByRole("status", { name: "任务状态" })).toContainText("图生图");
  await expect(page.getByRole("status", { name: "任务状态" })).toContainText("已完成");

  await page
    .getByTestId("left-parameter-panel")
    .getByRole("button", { name: "文生图", exact: true })
    .click();
  await page.getByLabel("流式预览").check();
  await creatorPrompt(page).fill("E2E 流式预览商业图");
  await page.getByRole("button", { name: "生成图片" }).click();
  await expect(page.getByLabel("流式预览结果")).toBeVisible();
  await expect(page.getByAltText("流式预览")).toBeVisible();
  await expect(page.getByRole("status", { name: "任务状态" })).toContainText("已完成");

  await page.getByLabel("批量 Prompt").fill("E2E 批量主图 A\nE2E 批量主图 B");
  await page.getByRole("button", { name: "创建批量任务" }).click();
  await expect(page.getByText("E2E 批量主图 A")).toBeVisible();
  await expect(page.getByText("批次 succeeded")).toBeVisible();

  const publishSeed = await createGeneratedWorkSeed(page);
  publicWorkId = publishSeed.workId;

  await page.getByLabel("同步素材库").click();
  await expect(page.getByText(publishSeed.assetId)).toBeVisible();
  await page.getByRole("button", { name: "发布作品" }).first().click();
  await page.getByLabel("作品标题").fill("E2E 社区公开作品");
  await page.getByLabel("可见性").selectOption("public");
  await page.getByLabel("确认公开发布").check();
  await page.getByRole("button", { name: "确认发布" }).click();
  await expect(page.getByText(/已发布：work_/)).toBeVisible();
});

test("社区覆盖排序筛选、点赞收藏、详情举报和同款隐私", async ({ page }) => {
  expect(publicWorkId).toMatch(/^work_/);
  await bindE2ESession(page, "user");

  await page.goto("/community?sort=featured");
  await expect(page.getByRole("heading", { name: "灵感社区" })).toBeVisible();
  await expect(page.getByText("E2E 社区私密作品")).toBeVisible();
  await expect(page.getByLabel("社区筛选")).toBeVisible();
  const workCard = page
    .locator("article.community-work-card")
    .filter({ hasText: "E2E 社区私密作品" });
  await expect(workCard).toHaveCount(1);
  await workCard.getByRole("button", { name: /点赞 0/ }).click();
  await expect(workCard.getByRole("button", { name: /已点赞 1/ })).toBeVisible();
  await workCard.getByRole("button", { name: /收藏 0/ }).click();
  await expect(workCard.getByRole("button", { name: /已收藏 1/ })).toBeVisible();

  await page.goto(`/community/works/${publicWorkId}`);
  await expect(page.getByRole("heading", { name: "E2E 社区私密作品" })).toBeVisible();
  await expect(page.getByText("Prompt 未公开")).toBeVisible();
  await expect(page.getByText(hiddenPrompt)).toHaveCount(0);
  await page.getByRole("button", { name: "生成同款草稿" }).click();
  await expect(page.getByRole("link", { name: "套用到创作台" })).toHaveAttribute(
    "href",
    `/?same_work=${publicWorkId}`
  );
  await expect(page.getByText(hiddenPrompt)).toHaveCount(0);
  await page.getByRole("button", { name: "举报作品" }).click();
  await expect(page.getByText("已提交举报")).toBeVisible();
});

test("管理端覆盖运行时配置、举报处理和精选操作", async ({ page }) => {
  expect(publicWorkId).toMatch(/^work_/);
  await bindAdminSession(page);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "管理端" })).toBeVisible();
  await expect(page.getByLabel("usage 汇总")).toBeVisible();
  await expect(page.getByText("E2E 社区私密作品")).toBeVisible();

  await page.getByLabel("最大生成数量").fill("3");
  await page.getByRole("button", { name: "保存运行时配置" }).click();
  await expect(page.getByText("已保存")).toBeVisible();

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes(`/api/admin/community/works/${publicWorkId}/take-down`) &&
      response.ok()
    ),
    page.getByRole("button", { name: "下架" }).click()
  ]);
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes(`/api/admin/community/works/${publicWorkId}/restore`) &&
      response.ok()
    ),
    page.getByRole("button", { name: /恢复/ }).click()
  ]);
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes(`/api/admin/community/works/${publicWorkId}/feature`) &&
      response.ok()
    ),
    page.getByRole("button", { name: /精选/ }).click()
  ]);
});

async function bindManualKey(page: Page) {
  const baseUrl = await readFakeSub2APIBaseUrl();

  await page.goto("/settings");
  await page.getByLabel("Sub2API Base URL").fill(baseUrl);
  await page.getByLabel("API Key").fill("e2e-local-api-key");
  await page.getByRole("button", { name: "保存到 BFF" }).click();
  await expect(page.getByText("已通过 BFF 建立 key binding。")).toBeVisible();

  const browserStorage = await page.evaluate(() =>
    JSON.stringify({
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage }
    })
  );
  expect(browserStorage).not.toContain("e2e-local-api-key");
}

function creatorPrompt(page: Page) {
  return page.getByTestId("center-workspace").getByLabel("Prompt", {
    exact: true
  });
}

async function bindAdminSession(page: Page) {
  await bindE2ESession(page, "admin");
}

async function expectFixedProductShell(page: Page) {
  const layout = await page.evaluate(() => {
    const shell = document.querySelector(".product-shell");
    const transcript = document.querySelector(".chat-transcript");
    const workbench = document.querySelector(".product-workbench-body");

    return {
      viewportHeight: window.innerHeight,
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      bodyClientHeight: document.body.clientHeight,
      bodyScrollHeight: document.body.scrollHeight,
      shellBottom: shell?.getBoundingClientRect().bottom ?? 0,
      workbenchOverflowY: workbench
        ? getComputedStyle(workbench).overflowY
        : null,
      transcriptOverflowY: transcript
        ? getComputedStyle(transcript).overflowY
        : null
    };
  });

  expect(layout.documentScrollHeight).toBe(layout.documentClientHeight);
  expect(layout.bodyScrollHeight).toBe(layout.bodyClientHeight);
  expect(layout.shellBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.workbenchOverflowY).toBe("hidden");
  expect(layout.transcriptOverflowY).toBe("auto");
}

async function bindE2ESession(page: Page, role: "admin" | "user") {
  const response = await page.request.post("/api/e2e/session", {
    data: { role },
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

async function createGeneratedWorkSeed(page: Page) {
  const generation = await postJsonInBrowser(page, "/api/images/generations", {
    model: "gpt-image-2",
    size: "1024x1024",
    quality: "medium",
    n: 1,
    output_format: "png",
    output_compression: null,
    background: "auto",
    moderation: "auto",
    prompt: hiddenPrompt
  });
  const generationBody = generation.body;
  expect(
    generation.ok,
    JSON.stringify({ status: generation.status, body: generationBody })
  ).toBeTruthy();

  const taskId = generationBody.data.task_id as string;
  const assetId = generationBody.data.images[0].asset_id as string;
  const publish = await postJsonInBrowser(page, "/api/community/works", {
    task_id: taskId,
    asset_id: assetId,
    visibility: "public",
    title: "E2E 社区私密作品",
    scene: "电商主图",
    tags: ["e2e", "电商"],
    disclose_prompt: false,
    disclose_params: false,
    disclose_reference_images: false,
    allow_same_generation: true,
    allow_reference_reuse: false,
    public_confirmed: true
  });
  const publishBody = publish.body;
  expect(
    publish.ok,
    JSON.stringify({ status: publish.status, body: publishBody })
  ).toBeTruthy();

  return {
    assetId,
    taskId,
    workId: publishBody.data.work_id as string
  };
}

async function expectConcurrencyLimit(page: Page) {
  const fakeBaseUrl = await readFakeSub2APIBaseUrl();
  const prompt = `E2E 延迟并发 ${Date.now()}`;
  const payload = {
    model: "gpt-image-2",
    size: "1024x1024",
    quality: "medium",
    n: 1,
    output_format: "png",
    output_compression: null,
    background: "auto",
    moderation: "auto",
    prompt
  };
  await page.evaluate((requestPayload) => {
    const state = window as Window & {
      __psypicFirstGeneration?: Promise<Response>;
    };
    state.__psypicFirstGeneration = fetch("/api/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestPayload)
    });
  }, payload);

  await waitForFakeSub2APIRequest(fakeBaseUrl, prompt);

  const result = await page.evaluate(async (requestPayload) => {
    const state = window as Window & {
      __psypicFirstGeneration?: Promise<Response>;
    };
    const secondResponse = await fetch("/api/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestPayload)
    });
    const secondBody = await secondResponse.json();
    const firstResponse = await state.__psypicFirstGeneration;
    delete state.__psypicFirstGeneration;

    return {
      firstStatus: firstResponse?.status ?? 0,
      secondStatus: secondResponse.status,
      secondBody
    };
  }, payload);

  expect(result.firstStatus).toBe(200);
  expect(result.secondStatus).toBe(429);
  expect(result.secondBody.error.code).toBe("rate_limited");
}

async function waitForFakeSub2APIRequest(baseUrl: string, marker: string) {
  const controlUrl = new URL("/__e2e/requests", baseUrl);
  controlUrl.searchParams.set("marker", marker);

  await expect
    .poll(async () => {
      const response = await fetch(controlUrl);
      const body = (await response.json()) as { count?: number };

      return body.count ?? 0;
    })
    .toBeGreaterThan(0);
}

async function postJsonInBrowser(
  page: Page,
  url: string,
  payload: Record<string, unknown>
) {
  return page.evaluate(
    async ({ requestUrl, requestPayload }) => {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestPayload)
      });
      const body = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        status: response.status,
        body
      };
    },
    { requestUrl: url, requestPayload: payload }
  );
}

async function readFakeSub2APIBaseUrl() {
  const file = await readFile(
    path.join(process.cwd(), "output", "playwright", "fake-sub2api.json"),
    "utf8"
  );

  return (JSON.parse(file) as { baseUrl: string }).baseUrl;
}
