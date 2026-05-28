import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

test.describe.configure({ mode: "serial" });

type E2ESession = {
  cookie: string;
  sessionId: string;
  userId: string;
};

type EvidenceStep = {
  step: string;
  status: "passed";
  artifact?: string;
  details?: Record<string, unknown>;
};

async function readFakeSub2APIBaseUrl() {
  const file = await readFile(
    path.join(process.cwd(), "output", "playwright", "fake-sub2api.json"),
    "utf8"
  );
  return (JSON.parse(file) as { baseUrl: string }).baseUrl;
}

async function bindE2ESession(
  page: Page,
  role: "admin" | "user",
  options?: { baseUrl?: string; apiKey?: string }
): Promise<E2ESession> {
  const response = await page.request.post("/api/e2e/session", {
    data: {
      role,
      ...(options?.baseUrl ? { base_url: options.baseUrl } : {}),
      ...(options?.apiKey ? { api_key: options.apiKey } : {})
    },
    headers: { "x-psypic-e2e-token": "e2e" }
  });
  const body = await response.json();

  expect(response.ok()).toBeTruthy();

  const baseURL = new URL(
    page.url().startsWith("http")
      ? page.url()
      : `http://127.0.0.1:${process.env.PSYPIC_E2E_PORT ?? 3200}`
  );
  const sessionId = body.data.session_id as string;

  await page.context().addCookies([
    {
      name: "psypic_session",
      value: sessionId,
      url: baseURL.origin,
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);

  return {
    cookie: `psypic_session=${sessionId}`,
    sessionId,
    userId: body.data.user_id as string
  };
}

async function writeEvidence(steps: EvidenceStep[]) {
  const artifactPath = path.join(
    process.cwd(),
    "output",
    "playwright",
    "acceptance",
    "rc1-community-admin.desktop.json"
  );
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(
    artifactPath,
    JSON.stringify(
      {
        suite: "RC1 community and admin acceptance",
        generated_at: new Date().toISOString(),
        steps
      },
      null,
      2
    )
  );
}

test("generated asset publishes to community, remixes from detail, and closes admin moderation", async ({
  page
}) => {
  test.setTimeout(240_000);
  const evidence: EvidenceStep[] = [];
  const baseUrl = await readFakeSub2APIBaseUrl();
  const user = await bindE2ESession(page, "user", {
    baseUrl,
    apiKey: "e2e-community-admin-key"
  });

  evidence.push({
    step: "login-and-key-binding",
    status: "passed",
    details: { user_id: user.userId, key_binding_source: "e2e-session" }
  });

  const generationResponse = await page.request.post("/api/images/generations", {
    data: {
      prompt: "RC1 public perfume hero acceptance",
      model: "gpt-image-2",
      size: "1024x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
      background: "auto",
      moderation: "auto"
    },
    headers: { cookie: user.cookie }
  });
  const generationBody = await generationResponse.json();

  expect(generationResponse.ok()).toBeTruthy();
  const taskId = generationBody.data.task_id as string;
  const assetId = generationBody.data.images[0].asset_id as string;
  evidence.push({
    step: "text-to-image-enters-library",
    status: "passed",
    details: { task_id: taskId, asset_id: assetId }
  });

  const libraryResponse = await page.request.get("/api/library?limit=30", {
    headers: { cookie: user.cookie }
  });
  const libraryBody = await libraryResponse.json();
  expect(libraryResponse.ok()).toBeTruthy();
  expect(libraryBody.data.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        asset_id: assetId,
        task_id: taskId
      })
    ])
  );

  const createWorkResponse = await page.request.post("/api/community/works", {
    data: {
      task_id: taskId,
      asset_id: assetId,
      visibility: "public",
      title: "RC1 公开验收作品",
      scene: "ecommerce",
      tags: ["RC1", "验收", "社区"],
      disclose_prompt: true,
      disclose_params: true,
      disclose_reference_images: false,
      allow_same_generation: true,
      allow_reference_reuse: false,
      public_confirmed: true
    },
    headers: { cookie: user.cookie }
  });
  const createWorkBody = await createWorkResponse.json();

  expect(createWorkResponse.ok()).toBeTruthy();
  const workId = createWorkBody.data.work_id as string;
  evidence.push({
    step: "library-asset-publishes-to-community",
    status: "passed",
    details: { work_id: workId, visibility: "public" }
  });

  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "灵感社区" })).toBeVisible();
  await expect(page.getByText("RC1 公开验收作品")).toBeVisible();

  await page.goto(`/community/works/${workId}`);
  await expect(page.getByRole("heading", { name: "RC1 公开验收作品" })).toBeVisible();
  await page.getByRole("button", { name: "生成同款草稿" }).click();
  await expect(page.getByText("RC1 public perfume hero acceptance")).toBeVisible();
  await page.screenshot({
    path: "output/playwright/screenshots/community-detail-same-desktop.png",
    fullPage: true
  });
  evidence.push({
    step: "community-detail-generates-same-draft",
    status: "passed",
    artifact: "output/playwright/screenshots/community-detail-same-desktop.png",
    details: { work_id: workId }
  });

  const reportResponse = await page.request.post("/api/community/reports", {
    data: {
      work_id: workId,
      reason: "privacy",
      details: "RC1 管理台验收举报。"
    },
    headers: { cookie: user.cookie }
  });
  const reportBody = await reportResponse.json();
  expect(reportResponse.ok()).toBeTruthy();

  const admin = await bindE2ESession(page, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "管理端" })).toBeVisible();
  await expect(page.getByText("RC1 公开验收作品")).toBeVisible();
  await expect(page.getByText("RC1 管理台验收举报。")).toBeVisible();
  await page.screenshot({
    path: "output/playwright/screenshots/admin-moderation-desktop.png",
    fullPage: true
  });

  const featureResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/admin/community/works/${workId}/feature`)
  );
  await page.getByRole("button", { name: "精选" }).click();
  expect((await featureResponse).ok()).toBeTruthy();

  const takeDownResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/admin/community/works/${workId}/take-down`)
  );
  await page.getByRole("button", { name: "下架" }).click();
  expect((await takeDownResponse).ok()).toBeTruthy();

  const takenDownDetailResponse = await page.request.get(
    `/api/community/works/${workId}`,
    {
      headers: { cookie: admin.cookie }
    }
  );
  expect(takenDownDetailResponse.status()).toBe(404);

  const restoreResponse = await page.request.post(
    `/api/admin/community/works/${workId}/restore`,
    {
      data: { reason: "RC1 restore acceptance" },
      headers: { cookie: admin.cookie }
    }
  );
  expect(restoreResponse.ok()).toBeTruthy();

  const restoredDetailResponse = await page.request.get(
    `/api/community/works/${workId}`,
    {
      headers: { cookie: admin.cookie }
    }
  );
  const restoredDetailBody = await restoredDetailResponse.json();
  expect(restoredDetailResponse.ok()).toBeTruthy();
  expect(restoredDetailBody.data).toMatchObject({
    work_id: workId,
    featured: true,
    title: "RC1 公开验收作品"
  });

  evidence.push({
    step: "admin-moderates-restores-and-features-work",
    status: "passed",
    artifact: "output/playwright/screenshots/admin-moderation-desktop.png",
    details: {
      work_id: workId,
      report_id: reportBody.data.report_id,
      admin_user_id: admin.userId
    }
  });

  await writeEvidence(evidence);
});
