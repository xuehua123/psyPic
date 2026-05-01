# PsyPic V1 完整收口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 PsyPic 从当前 v0.9/V1 基础能力推进到可封板 V1.0，覆盖管理端、社区互动、批量工作流、任务队列、多参考图、E2E、移动端和生产封板。

**Architecture:** 采用纵向切片推进，每个切片都包含 Prisma/内存开发服务、BFF Route Handler、前端页面、测试和文档验收更新。短期继续沿用当前 in-memory dev store + Prisma schema 的双轨模式，生产持久化入口通过 Prisma 模型和清晰的服务边界预留。所有前端只调用 PsyPic `/api/*`，不直接接触 Sub2API。

**Tech Stack:** Next.js App Router、TypeScript、Prisma、Vitest、Testing Library、Playwright、Tailwind CSS、lucide-react。

---

## 执行原则

- 每个行为变更先写失败测试，再实现，再回归。
- 每个阶段完成后运行：`git diff --check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm prisma validate`、敏感词扫描、`pnpm build`。
- 提交信息使用中文，专业术语保留英文。
- 文档、README、验收清单同步更新，不把“已实现但未勾选”的项目留到最后。
- 前端设计保持工作台/管理台风格：信息密度高、控件明确、避免营销页和装饰性卡片堆叠。

## Task 1: v0.9 管理端和持久化运行时配置

**Files:**
- Create: `app/admin/page.tsx`
- Create: `components/admin/AdminDashboardPage.tsx`
- Create: `app/api/admin/runtime-settings/route.ts`
- Create: `app/api/admin/community/reports/route.ts`
- Create: `app/api/admin/community/works/[workId]/restore/route.ts`
- Create: `app/api/admin/community/works/[workId]/feature/route.ts`
- Modify: `server/services/runtime-settings-service.ts`
- Modify: `server/services/community-service.ts`
- Modify: `server/services/dev-store.ts`
- Modify: `prisma/schema.prisma`
- Test: `tests/api/admin-runtime-settings.test.ts`
- Test: `tests/api/community-moderation.test.ts`
- Test: `tests/components/admin-dashboard.test.tsx`

- [ ] Add Prisma models for persisted runtime settings and community moderation fields.
- [ ] Add failing API tests for admin-only settings read/update.
- [ ] Add failing API tests for report listing, take-down, restore and feature.
- [ ] Implement runtime settings service with environment defaults plus persisted override.
- [ ] Implement admin report listing and moderation actions.
- [ ] Add admin dashboard page with usage summary, limits, publish toggle, report queue and moderation controls.
- [ ] Add audit log writes for admin actions.
- [ ] Run task-level verification and commit.

## Task 2: V1 社区点赞、收藏、精选和举报体验

**Files:**
- Create: `app/api/community/works/[workId]/favorite/route.ts`
- Create: `app/api/community/works/[workId]/like/route.ts`
- Modify: `server/services/community-service.ts`
- Modify: `components/community/CommunityFeedPage.tsx`
- Modify: `components/community/CommunityWorkDetailPage.tsx`
- Modify: `prisma/schema.prisma`
- Test: `tests/api/community-interactions.test.ts`
- Test: `tests/components/community-feed.test.tsx`
- Test: `tests/components/community-work-detail.test.tsx`

- [ ] Add models and dev-store maps for likes/favorites.
- [ ] Add failing API tests for like/favorite idempotency, ownership and private-work 404.
- [ ] Expose `like_count`、`favorite_count`、`liked`、`favorited`、`featured_at` in list/detail responses.
- [ ] Add sorting by latest/popular/featured and tag filtering.
- [ ] Add feed and detail controls for like/favorite/report/same-generation.
- [ ] Verify hidden prompt/params stay hidden in detail and same-generation draft.
- [ ] Run task-level verification and commit.

## Task 3: 任务队列和批量工作流

**Files:**
- Create: `server/services/image-job-queue-service.ts`
- Create: `app/api/batches/route.ts`
- Create: `app/api/batches/[batchId]/route.ts`
- Create: `app/api/batches/[batchId]/retry/route.ts`
- Create: `components/creator/BatchWorkflowPanel.tsx`
- Modify: `server/services/image-task-service.ts`
- Modify: `components/creator/CreatorWorkspace.tsx`
- Modify: `prisma/schema.prisma`
- Test: `tests/api/image-job-queue.test.ts`
- Test: `tests/api/batches.test.ts`
- Test: `tests/components/batch-workflow.test.tsx`

- [ ] Add queue states and image batch models.
- [ ] Add failing tests for enqueue, active limit, queued cancellation, timeout and retry.
- [ ] Implement in-process queue service with clear Redis/DB-backed replacement boundary.
- [ ] Add batch prompt, CSV import, multi-size expansion and retry endpoints.
- [ ] Add creator batch workflow UI with progress, per-item failure and retry.
- [ ] Run task-level verification and commit.

## Task 4: 多参考图和参数边界

**Files:**
- Modify: `lib/validation/image-params.ts`
- Modify: `lib/validation/upload.ts`
- Modify: `app/api/images/edits/route.ts`
- Modify: `components/creator/ReferenceUploader.tsx`
- Modify: `components/creator/CreatorWorkspace.tsx`
- Test: `tests/api/image-edits.test.ts`
- Test: `tests/components/reference-uploader.test.tsx`

- [ ] Add failing tests for multiple references and per-file validation.
- [ ] Add failing tests for JPEG/WebP compression, custom size normalization and max dimension.
- [ ] Implement multi-reference multipart forwarding.
- [ ] Update uploader UI with ordered references and removal controls.
- [ ] Run task-level verification and commit.

## Task 5: E2E、移动端和封板文档

**Files:**
- Create/Modify: `tests/e2e/*`
- Create: `docs/部署与回滚.md`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/06-开发阶段路线图.md`
- Modify: `docs/07-验收清单.md`
- Modify: `docs/17-测试与验收用例.md`

- [ ] Fix Playwright execution path on Windows/Codex environment.
- [ ] Cover import, manual key, generation, edit, mask, stream, library, community publish, same-generation, report and admin flows.
- [ ] Add mobile viewport coverage for creator, library, community and admin.
- [ ] Add deployment, storage, rollback and production environment docs.
- [ ] Run DB migration validation, security scan and build.
- [ ] Run final full regression, tag `v1.0` after user approval.
