# Frontend Workbench Final Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 PsyPic 前端正式接入 DB Auth、Workbench Project/Session/VersionNode、generation/edit workbench context、JobRuntimeEvent，并保留 IndexedDB fallback/offline cache，让核心工作台进入可发布状态。

**Architecture:** 不重写 CreatorWorkspace 视觉和交互骨架，先新增 typed API clients、server-first hooks、IndexedDB cache/outbox，再逐步替换现有 `useProjects` / `useBranchMeta` / `versionNodes` 本地状态。ProjectSidebar、Composer、ChatTranscript、VersionStream、TaskStatusStrip 继续作为 UI 表层；数据来源从本地 seeds/IndexedDB 切到 server-first + offline cache。

**Tech Stack:** Next.js App Router, React client components, native IndexedDB, existing UI components, Vitest + Testing Library, Playwright smoke, existing `/api/session`, `/api/settings/manual-key`, `/api/workbench/*`, `/api/images/*`, `/api/workbench/job-runtime-events`.

---

## Non-Negotiable Scope

- Do not implement Board Mode.
- Do not redesign the whole app shell.
- Do not remove IndexedDB fallback.
- Do not create a throwaway rough integration; every Cut must move toward final UI.
- Do not bypass backend auth/workbench APIs with local-only shortcuts except explicit fallback mode.
- Do not make one giant commit. Each Cut gets a main commit plus post-review fix commit if needed.

---

## Current Frontend Baseline

- `components/creator/CreatorWorkspace.tsx` owns most state: active project, active conversation, local `versionNodes`, local `nodeProjectIds`, current task and generation submit flow.
- `lib/creator/use-projects.ts` reads/writes `lib/creator/projects-store.ts` IndexedDB only.
- `lib/creator/use-branch-meta.ts` reads/writes `lib/creator/branch-meta-store.ts` IndexedDB only.
- `lib/creator/version-graph.ts` creates local `CreatorVersionNode` objects from local generation/history.
- `ProjectSidebar` is present and should remain the primary sidebar UI.
- Backend is already ready on `origin/main`: DB auth, manual key binding, Workbench CRUD/sync, ImageTask-VersionNode link, JobRuntimeEvent, health/audit, Prisma pg adapter.

---

## Global Invariants

- Server is source of truth when `PSYPIC_WORKBENCH_PROJECTS_STORE=database`.
- IndexedDB remains local cache + offline/outbox store, not independent truth.
- Fallback mode (`indexeddb` or API `503`) must keep V1.0 local behavior usable.
- Existing ProjectSidebar workflows must keep their visual behavior.
- Existing generation/edit request bodies must remain valid without workbench context.
- Context-aware generation/edit must include `project_id`, `session_id`, and optional `parent_version_node_id`.
- Frontend must never send `board_*` fields except future Board Mode; this plan only preserves backend compatibility.
- All new API clients must handle `request_id`, JSON errors and `503 Retry-After`.

---

## Cut 0: Branch And Contract Audit

**Goal:** Start isolated frontend work and lock the exact backend/client contracts before changing UI.

**Files:**
- Create: `docs/superpowers/plans/2026-05-11-frontend-workbench-final.md` (this file)
- Create: `docs/frontend-workbench-contract-notes.md`

**Checklist:**

- [ ] Create branch `codex/frontend-workbench-final` from `origin/main`.
- [ ] Inspect `/api/session`, `/api/settings/manual-key`, `/api/workbench/*`, `/api/workbench/sync`, `/api/workbench/job-runtime-events`, `/api/images/generations`, `/api/images/edits`.
- [ ] Document response shapes and error codes in `docs/frontend-workbench-contract-notes.md`.
- [ ] Identify where existing UI consumes project/session/node/task state.
- [ ] Run baseline `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- [ ] Commit: `docs(frontend): map workbench client contracts`

**Post-review required:** Confirm no code behavior changed.

---

## Cut 1: Auth And Manual Key Frontend Shell

**Goal:** Make the app understand DB session state and expose production-grade login/register/logout/manual-key binding without replacing the creator UI.

**Files:**
- Create: `lib/client/session-api.ts`
- Create: `lib/client/auth-api.ts`
- Create: `lib/client/manual-key-api.ts`
- Create: `lib/client/api-result.ts`
- Create: `components/auth/AuthDialog.tsx`
- Create: `components/auth/SessionGate.tsx`
- Modify: `components/layout/AppShell.tsx`
- Modify: `app/settings/page.tsx`
- Test: `tests/components/auth-session.test.tsx`
- Test: `tests/components/api-settings-form.test.tsx`

**Checklist:**

- [ ] Add typed fetch helper for `{ data, request_id }` / `{ error, request_id }`.
- [ ] Add `getSession`, `login`, `register`, `logout`, `bindManualKey` clients.
- [ ] Add session state hook with authenticated/anonymous/loading/error states.
- [ ] Add login/register dialog reachable from shell or settings.
- [ ] Keep existing settings/manual-key page, but make it bind to DB session when logged in.
- [ ] Show binding status from `/api/session`.
- [ ] Do not store API key in localStorage/sessionStorage/IndexedDB.
- [ ] Tests cover anonymous, login success, logout, manual key bound session shape.
- [ ] Commit: `feat(frontend): add auth session and manual key shell`

**Verification:**

```bash
pnpm vitest --run tests/components/auth-session.test.tsx tests/components/api-settings-form.test.tsx tests/api/session.test.ts tests/api/manual-key.test.ts
pnpm typecheck
pnpm lint
git diff --check
```

**Post-review required:** Check no secret is persisted client-side.

---

## Cut 2: Workbench API Client And Local Cache Schema

**Goal:** Add a frontend data access layer for Workbench CRUD/sync and define IndexedDB cache/outbox stores without wiring the UI yet.

**Files:**
- Create: `lib/creator/workbench-api.ts`
- Create: `lib/creator/workbench-types.ts`
- Create: `lib/creator/workbench-cache-store.ts`
- Create: `lib/creator/workbench-outbox-store.ts`
- Create: `lib/creator/workbench-mappers.ts`
- Test: `tests/unit/workbench-mappers.test.ts`
- Test: `tests/unit/workbench-cache-store.test.ts`

**Checklist:**

- [ ] Define frontend types for WorkbenchProject, CreativeSession, VersionNode, JobRuntimeEvent, sync mutation.
- [ ] Implement typed clients for project/session/version-node CRUD.
- [ ] Implement typed client for `/api/workbench/sync` pull/push.
- [ ] Implement typed client for `/api/workbench/job-runtime-events`.
- [ ] Add IndexedDB cache stores for projects/sessions/versionNodes/outbox metadata.
- [ ] Map server snake_case to current `CreatorProjectMeta`, `SidebarProjectGroup`, `CreatorVersionNode`.
- [ ] Ensure `503` maps to fallback mode, not a fatal crash.
- [ ] Tests cover mapping of BranchMeta fields, status values and deleted tombstones.
- [ ] Commit: `feat(frontend): add workbench api clients and cache stores`

**Verification:**

```bash
pnpm vitest --run tests/unit/workbench-mappers.test.ts tests/unit/workbench-cache-store.test.ts
pnpm typecheck
pnpm lint
git diff --check
```

**Post-review required:** Check mapping does not drop `customLabel/isPinned/isArchived/lastReadAt`.

---

## Cut 3: Server-First Projects And Sessions Hook

**Goal:** Replace `useProjects` and branch meta behavior with server-first project/session data while keeping ProjectSidebar props stable.

**Files:**
- Modify: `lib/creator/use-projects.ts`
- Modify: `lib/creator/projects-store.ts`
- Modify: `lib/creator/use-branch-meta.ts`
- Create: `lib/creator/use-workbench.ts`
- Modify: `components/creator/CreatorWorkspace.tsx`
- Test: `tests/unit/use-projects.test.ts`
- Test: `tests/components/project-sidebar-crud.test.tsx`
- Test: `tests/components/project-sidebar-context-menu.test.tsx`
- Test: `tests/components/creator-shell.test.tsx`

**Checklist:**

- [ ] Build `useWorkbench` that loads IndexedDB cache immediately, then refreshes from server.
- [ ] Preserve `useProjects` public signature for existing ProjectSidebar calls.
- [ ] Route create/rename/delete project through Workbench API in database mode.
- [ ] Route session label/pin/archive/read/unread through CreativeSession API.
- [ ] Keep local fallback when API returns `503`.
- [ ] Do not change ProjectSidebar visual layout.
- [ ] Update CreatorWorkspace to derive sidebar projects from server sessions instead of local-only branch meta when available.
- [ ] Tests cover server success, 503 fallback, project CRUD, session meta mutation.
- [ ] Commit: `feat(frontend): connect project sidebar to workbench api`

**Verification:**

```bash
pnpm vitest --run tests/unit/use-projects.test.ts tests/components/project-sidebar-crud.test.tsx tests/components/project-sidebar-context-menu.test.tsx tests/components/creator-shell.test.tsx
pnpm typecheck
pnpm lint
git diff --check
```

**Post-review required:** Check fallback mode still shows default seed projects.

---

## Cut 4: VersionNode Data Flow And Generation Context

**Goal:** Make CreatorWorkspace submit generation/edit with workbench context and use returned/loaded VersionNodes as the durable graph.

**Files:**
- Modify: `lib/creator/version-graph.ts`
- Create: `lib/creator/use-version-nodes.ts`
- Modify: `components/creator/CreatorWorkspace.tsx`
- Modify: `components/creator/studio/VersionStreamSection.tsx`
- Modify: `components/creator/studio/NodeInspectorSection.tsx`
- Test: `tests/unit/version-graph.test.ts`
- Test: `tests/components/creator-shell.test.tsx`
- Test: `tests/api/image-generations.test.ts`
- Test: `tests/api/image-edits.test.ts`

**Checklist:**

- [ ] Load version nodes for selected server session.
- [ ] Map server VersionNode status values to `CreatorVersionNode`.
- [ ] Preserve local history import as fallback/legacy display only.
- [ ] Include `project_id`, `session_id`, `parent_version_node_id` in generation JSON.
- [ ] Include those fields in edits `FormData`.
- [ ] When API returns task/version linkage, merge server node into UI graph.
- [ ] Ensure fork/derive flows use server node ids.
- [ ] Keep old no-context generation path usable in fallback mode.
- [ ] Tests verify submitted request includes context and old mode does not.
- [ ] Commit: `feat(frontend): link generation flows to version nodes`

**Verification:**

```bash
pnpm vitest --run tests/unit/version-graph.test.ts tests/components/creator-shell.test.tsx tests/api/image-generations.test.ts tests/api/image-edits.test.ts
pnpm typecheck
pnpm lint
git diff --check
```

**Post-review required:** Check no client-generated node overwrites server node ids.

---

## Cut 5: Offline Sync And Outbox UX

**Goal:** Implement final offline/outbox behavior for workbench operations, not just API calls.

**Files:**
- Create: `lib/creator/sync/sync-engine.ts`
- Create: `lib/creator/sync/conflict-resolver.ts`
- Create: `lib/creator/sync/sync-types.ts`
- Modify: `lib/creator/use-workbench.ts`
- Modify: `components/creator/studio/ProjectSidebar.tsx`
- Create: `components/creator/studio/SyncStatusIndicator.tsx`
- Test: `tests/unit/sync-engine.test.ts`
- Test: `tests/unit/conflict-resolver.test.ts`
- Test: `tests/components/creator-shell.test.tsx`

**Checklist:**

- [ ] Implement read-through cache: IndexedDB first, server pull second.
- [ ] Implement write-through optimistic updates.
- [ ] Enqueue outbox mutations before/while pushing.
- [ ] Flush outbox on reconnect/app focus/manual retry.
- [ ] Apply backend conflict payloads with last-write-wins messaging.
- [ ] Apply tombstones to cache.
- [ ] Add compact sync status indicator: synced / offline / syncing / needs attention.
- [ ] Keep operation count bounded and surface retryable failure.
- [ ] Tests cover online write, offline queue, replay, conflict, tombstone.
- [ ] Commit: `feat(frontend): add workbench offline sync engine`

**Verification:**

```bash
pnpm vitest --run tests/unit/sync-engine.test.ts tests/unit/conflict-resolver.test.ts tests/components/creator-shell.test.tsx
pnpm typecheck
pnpm lint
git diff --check
```

**Post-review required:** Check cache and outbox cannot corrupt each other on partial failure.

---

## Cut 6: JobRuntimeEvent Task Dock

**Goal:** Replace the single transient task strip with a backend-driven task event view while keeping current strip behavior for the active task.

**Files:**
- Create: `lib/creator/use-job-runtime-events.ts`
- Create: `components/creator/studio/TaskDockSection.tsx`
- Modify: `components/creator/studio/TaskStatusStrip.tsx`
- Modify: `components/creator/studio/ChatTranscript.tsx`
- Modify: `components/creator/CreatorWorkspace.tsx`
- Test: `tests/components/task-dock.test.tsx`
- Test: `tests/components/creator-shell.test.tsx`

**Checklist:**

- [ ] Fetch events by active task and active version node.
- [ ] Show queued/running/partial_image/succeeded/failed/canceled/timed_out.
- [ ] Keep cancel/retry actions wired to existing task APIs.
- [ ] Surface partial image events without hiding existing partial preview strip.
- [ ] Add empty/loading/error states.
- [ ] Do not add Board Mode.
- [ ] Tests cover status rendering, filtering, retry/cancel availability.
- [ ] Commit: `feat(frontend): add task dock from runtime events`

**Verification:**

```bash
pnpm vitest --run tests/components/task-dock.test.tsx tests/components/creator-shell.test.tsx
pnpm typecheck
pnpm lint
git diff --check
```

**Post-review required:** Check Task Dock does not duplicate or contradict active task strip.

---

## Cut 7: Auth-Gated Empty, Error And Fallback States

**Goal:** Make the final UX coherent: anonymous users, unbound users, DB unavailable, workbench fallback, offline queue and generation errors are all understandable.

**Files:**
- Modify: `components/auth/SessionGate.tsx`
- Modify: `components/creator/CreatorWorkspace.tsx`
- Modify: `components/creator/studio/ChatEmptyState.tsx`
- Modify: `components/creator/studio/ProjectSidebar.tsx`
- Modify: `app/settings/page.tsx`
- Test: `tests/components/auth-session.test.tsx`
- Test: `tests/components/creator-shell.test.tsx`
- Test: `tests/components/api-settings-form.test.tsx`

**Checklist:**

- [ ] Anonymous user sees login/register path, not a broken workbench.
- [ ] Authenticated but unbound user sees manual key setup path.
- [ ] Workbench `503` shows local fallback notice.
- [ ] Offline outbox pending state is visible.
- [ ] API errors show request id when useful.
- [ ] Text must fit mobile and desktop containers.
- [ ] No landing/marketing page; first screen remains usable app.
- [ ] Commit: `feat(frontend): harden workbench auth and fallback states`

**Verification:**

```bash
pnpm vitest --run tests/components/auth-session.test.tsx tests/components/creator-shell.test.tsx tests/components/api-settings-form.test.tsx
pnpm typecheck
pnpm lint
git diff --check
```

**Post-review required:** Check no explanatory wall of text clutters the workbench.

---

## Cut 8: Playwright Smoke And Visual QA

**Goal:** Verify the final frontend works as an app across desktop/mobile flows.

**Files:**
- Create: `tests/e2e/workbench-auth-sync.spec.ts`
- Create: `tests/e2e/workbench-generation-events.spec.ts`
- Modify: `tests/e2e/support/fake-sub2api.ts`
- Modify: `docs/部署与回滚.md`

**Checklist:**

- [ ] Start app against local Docker staging-like DB.
- [ ] Smoke register/login/logout.
- [ ] Smoke manual key binding.
- [ ] Smoke project create/rename/delete.
- [ ] Smoke session label/pin/archive/read.
- [ ] Smoke generation with workbench context.
- [ ] Smoke JobRuntimeEvent display.
- [ ] Smoke fallback mode if app env allows it.
- [ ] Capture desktop and mobile screenshots.
- [ ] Document remaining non-blockers.
- [ ] Commit: `test(e2e): add final workbench frontend smoke`

**Verification:**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm e2e
git diff --check
```

**Post-review required:** Inspect screenshots for overlapping text, broken sidebars, and mobile modal overflow.

---

## Cut 9: Final Frontend Gate And Merge Prep

**Goal:** Stabilize, review and prepare the frontend branch for merge.

**Files:**
- Modify: `docs/superpowers/plans/2026-05-11-frontend-workbench-final.md`
- Modify: `docs/部署与回滚.md` if smoke notes need final update

**Checklist:**

- [ ] Run full gate: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm e2e`.
- [ ] Run app locally and manually verify primary flows.
- [ ] Final code review: auth, workbench sync, generation context, task events, fallback.
- [ ] Fix P0/P1 before PR.
- [ ] Record P2 follow-ups.
- [ ] Commit: `docs(frontend): record workbench frontend final gate`

**Post-review required:** Do not merge if ProjectSidebar loses data in fallback mode or generation loses VersionNode context.

---

## Standard Cut Footer

Every execution prompt must end with:

```text
全绿后提交：
<commit message>

提交后不要开始下一个 Cut。请先做一次 post-review：
- 重新看本次 diff。
- 找边界遗漏、测试缺口、权限/跨用户风险、fallback/offline 风险、UI 状态风险。
- 如果发现问题，最小修复并单独提交 fix commit。
- 再跑本 Cut 的验证命令。
- 最后汇报：
  1. 主提交 hash
  2. fix 提交 hash（如有）
  3. 验证命令结果
  4. git status
```

---

## Recommended Branch And Commit Order

Branch:

```bash
git checkout main
git pull --ff-only
git checkout -b codex/frontend-workbench-final
```

Commit order:

1. `docs(frontend): map workbench client contracts`
2. `feat(frontend): add auth session and manual key shell`
3. `feat(frontend): add workbench api clients and cache stores`
4. `feat(frontend): connect project sidebar to workbench api`
5. `feat(frontend): link generation flows to version nodes`
6. `feat(frontend): add workbench offline sync engine`
7. `feat(frontend): add task dock from runtime events`
8. `feat(frontend): harden workbench auth and fallback states`
9. `test(e2e): add final workbench frontend smoke`
10. `docs(frontend): record workbench frontend final gate`

---

## First Execution Prompt

```text
我们在 E:\IdeaProjects\psyPic。

后端最大可用版已完成并推送 origin/main。现在开始最终前端开发。

请从 main 创建新分支：
codex/frontend-workbench-final

只执行 docs/superpowers/plans/2026-05-11-frontend-workbench-final.md 的 Cut 0：Branch And Contract Audit。

不要做 Board Mode。
不要改业务 UI。
不要进入 Cut 1。

目标：
- 读取后端 API route 和现有 Creator 前端数据层。
- 新建 docs/frontend-workbench-contract-notes.md。
- 记录 session/manual-key/workbench CRUD/sync/job-runtime-events/images API 的前端契约。
- 运行 baseline gate。

验证：
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check

全绿后提交：
docs(frontend): map workbench client contracts

提交后不要开始下一个 Cut。请先做一次 post-review：
- 重新看本次 diff。
- 确认只新增/更新文档，没有代码行为变化。
- 确认契约记录包含错误码、fallback、request_id、Retry-After。
- 如果发现问题，最小修复并单独提交 fix commit。
- 再跑本 Cut 的验证命令。
- 最后汇报：
  1. 主提交 hash
  2. fix 提交 hash（如有）
  3. 验证命令结果
  4. git status
```
