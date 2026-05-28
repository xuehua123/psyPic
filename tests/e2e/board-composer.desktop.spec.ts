import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe.configure({ mode: "serial" });

type RecordedFormDataFile = {
  name: string;
  type: string;
  size: number;
};

type RecordedFormDataEntry = {
  key: string;
  value: string | RecordedFormDataFile;
};

type E2EWindow = Window & {
  __psypicE2EEditSubmissions?: RecordedFormDataEntry[][];
};

async function bindE2ESession(page: Page, role: "admin" | "user") {
  const response = await page.request.post("/api/e2e/session", {
    data: { role },
    headers: { "x-psypic-e2e-token": "e2e" }
  });
  const body = await response.json();

  expect(response.ok()).toBeTruthy();

  const currentUrl = page.url();
  const urlObj =
    currentUrl.startsWith("http://") || currentUrl.startsWith("https://")
      ? new URL(currentUrl)
      : new URL(`http://127.0.0.1:${process.env.PSYPIC_E2E_PORT ?? 3200}`);

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

async function bindFakeSub2APIKey(page: Page) {
  await page.goto("/settings");
  await page.getByLabel("Sub2API Base URL").fill(await readFakeSub2APIBaseUrl());
  await page.getByLabel("API Key").fill("e2e-board-composer-key");
  await page.getByRole("button", { name: "保存到 BFF" }).click();
  await expect(page.getByText("已通过 BFF 建立 key binding。")).toBeVisible();
}

async function installEditSubmissionRecorder(page: Page) {
  await page.addInitScript(() => {
    const e2eWindow = window as E2EWindow;
    const originalFetch = window.fetch.bind(window);

    e2eWindow.__psypicE2EEditSubmissions = [];
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (url.includes("/api/images/edits") && init?.body instanceof FormData) {
        const entries: RecordedFormDataEntry[] = [];
        init.body.forEach((value, key) => {
          entries.push({
            key,
            value:
              typeof value === "string"
                ? value
                : {
                    name: value.name,
                    type: value.type,
                    size: value.size
                  }
          });
        });
        e2eWindow.__psypicE2EEditSubmissions?.push(entries);
      }

      return originalFetch(input, init);
    };
  });
}

async function readRecordedEditSubmissions(page: Page) {
  return page.evaluate(() => {
    const e2eWindow = window as E2EWindow;
    return e2eWindow.__psypicE2EEditSubmissions ?? [];
  });
}

test("Board export reference submits through Composer edits", async ({ page }) => {
  const editPrompt = "E2E Board Export Edit";

  await installEditSubmissionRecorder(page);
  await bindE2ESession(page, "user");
  await bindFakeSub2APIKey(page);

  await page.goto("/");
  await expect(page.getByText("新对话")).toBeVisible();

  const promptInput = page
    .getByTestId("center-workspace")
    .getByLabel("Prompt", { exact: true });

  await promptInput.fill("E2E Board Source Asset");
  await page.getByRole("button", { name: "生成图片" }).click();
  await expect(page.getByRole("status", { name: "任务状态" })).toContainText(
    "已完成"
  );
  await expect(
    page.getByTestId("active-gallery").getByAltText("生成结果")
  ).toBeVisible();

  await page.getByRole("button", { name: "同步素材库" }).click();
  const libraryAssetCard = page
    .locator('[data-testid^="library-asset-card-"]')
    .first();
  await expect(libraryAssetCard).toBeVisible();

  await page.getByTestId("creator-view-tab-board").click();
  const boardStage = page.getByTestId("board-stage");
  await expect(boardStage).toBeVisible();
  await expect(page.getByTestId("board-export-as-reference")).toBeDisabled();

  await libraryAssetCard.scrollIntoViewIfNeeded();
  await libraryAssetCard.dragTo(boardStage, {
    targetPosition: { x: 160, y: 240 },
    timeout: 30_000
  });

  await expect(page.getByTestId("board-layer-list-items")).toBeVisible();
  await expect(page.getByTestId("board-export-as-reference")).toBeEnabled();

  await page.getByTestId("board-export-as-reference").click();
  await expect(page.getByTestId("composer-reference-row")).toBeVisible();

  await promptInput.fill(editPrompt);

  const editResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/images/edits")
  );

  await page.getByRole("button", { name: "生成图片" }).click();

  const editResponse = await editResponsePromise;

  expect(editResponse.ok()).toBeTruthy();

  await expect(page.getByRole("status", { name: "任务状态" })).toContainText(
    "已完成"
  );
  await expect(
    page.getByTestId("active-gallery").getByAltText("生成结果")
  ).toBeVisible();
  await expect(page.getByTestId("task-dock-section")).toContainText("成功");

  const editSubmissions = await readRecordedEditSubmissions(page);
  const latestSubmission = editSubmissions.at(-1);
  expect(latestSubmission).toBeTruthy();
  if (!latestSubmission) {
    throw new Error("No Composer edit submission was recorded.");
  }

  expect(latestSubmission).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: "prompt", value: editPrompt })
    ])
  );

  const imageEntry = latestSubmission.find(
    (entry) => entry.key === "image" && typeof entry.value !== "string"
  );
  expect(imageEntry).toBeTruthy();
  if (!imageEntry || typeof imageEntry.value === "string") {
    throw new Error("Board export image was not submitted to edits.");
  }

  expect(imageEntry.value.name).toMatch(/^board-export-\d+-[a-z0-9]{4}\.png$/);
  expect(imageEntry.value.type).toBe("image/png");
  expect(imageEntry.value.size).toBeGreaterThan(0);

  await page.screenshot({
    path: "output/playwright/screenshots/board-composer-edits-desktop.png",
    fullPage: true
  });
});
