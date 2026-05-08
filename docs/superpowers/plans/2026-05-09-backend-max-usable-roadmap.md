# Backend Max Usable Roadmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 PsyPic 后端推进到“最大可用版”：DB-backed 登录注册、跨设备工作台、VersionNode 生成链路、后端同步契约、任务事件流、运维回滚都可独立支撑前端继续迭代。

**Architecture:** 先把身份系统从 `dev-store` 收敛到 Prisma-backed User / Session，再在此身份边界上实现 WorkbenchProject / CreativeSession / VersionNode 的服务端 CRUD。生成和编辑 API 继续保持 V1.0 兼容，但在带 workbench context 时创建并维护 VersionNode；后端提供 sync 所需的增量、幂等和冲突契约，前端可以先粗接入，后续再完整离线化。

**Tech Stack:** Next.js Route Handlers, Prisma 7, PostgreSQL, Zod, Vitest, native Web APIs, Node `crypto`, existing `jsonOk/jsonError` API response helpers.

---

## Scope

### Included

- DB-backed 注册、登录、登出、当前用户 session。
- `User / Session / KeyBinding` 从开发期内存会话过渡到 Prisma 会话。
- Workbench 后端：Project / Session / VersionNode domain service + REST API。
- 后端 sync 契约：增量拉取、批量 upsert、幂等 mutation、last-write-wins 冲突处理。
- 生成 / 编辑链路写入 VersionNode，并保持旧请求不带 context 时行为不变。
- JobRuntimeEvent 入库与查询 API，覆盖 7 状态。
- 运维：store 开关、审计、健康检查、staging migration + rollback 演练。

### Not Included

- Board Mode UI / Konva / 画布编辑器实现。
- 完整前端离线 outbox UI。
- 多人协作、实时 presence、CRDT。
- 第三方 OAuth。第一版 Auth 使用邮箱 + 密码，密码用 Node `crypto.scrypt` 派生，不新增 bcrypt 依赖。

### Phase C Boundary

Board Mode 仍是 Phase C。当前阶段只保留并使用 `VersionNode.boardDocumentId`、`boardSnapshot`、`boardExportAssetId` 这些后端字段；不要创建 BoardDocument / BoardExport API，不要改画布 UI。

---

## Current Baseline

- Phase B Cut 1 已提交：`e00641a feat(prisma): add workbench migration models`
- `prisma/schema.prisma` 已有：
  - `WorkbenchProject`
  - `CreativeSession`
  - `VersionNode`
  - `VersionNodeStatus`
  - `ImageTask.projectId/sessionId/versionNodeId`
- `PSYPIC_WORKBENCH_PROJECTS_STORE=database` 已加入 `.env.example`。
- 当前许多 API 仍通过 `server/services/dev-store.ts` 和 `psypic_session` cookie 表达开发期会话。

---

## Global Invariants

- 所有用户数据必须以 `userId` 隔离；跨用户访问返回 `403`。
- 未登录访问私有 API 返回 `401`。
- `ImageTask` 是计费 / 审计实体，删除 project 或 session 不删除历史 task。
- 老 V1.0 请求不带 workbench context 时必须继续工作。
- Workbench store 开关不是产品功能，只是部署回退：
  - `database`：API 使用 Prisma。
  - `indexeddb`：Workbench API 返回 `503` + `Retry-After`，前端 fallback 本地。
- 不回填假数据：旧 `image_tasks.project_id/session_id/version_node_id` 允许保持 `NULL`。
- 所有 route 返回统一 `jsonOk/jsonError` shape，并带 `request_id`。

---

## Cut 0: Auth Baseline

**Goal:** 用 Prisma-backed 用户和会话替换开发期身份边界，让 Workbench API 有稳定的“当前用户”。

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/{ts}_auth_baseline/migration.sql`
- Create: `lib/validation/auth.ts`
- Create: `server/services/auth-service.ts`
- Modify: `server/services/session-service.ts`
- Modify: `server/services/request-user-service.ts`
- Modify: `app/api/session/route.ts`
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Test: `tests/api/auth.test.ts`
- Test: `tests/api/session.test.ts`

**Checklist:**

- [ ] Add nullable-compatible auth fields to `User`: `email`, `emailVerifiedAt`, `passwordHash`, `passwordSalt`, `status`, `lastLoginAt`.
- [ ] Add unique index for normalized email; keep existing users valid.
- [ ] Create migration and inspect that existing users do not need fake email values.
- [ ] Add Zod schemas for register/login.
- [ ] Implement password hashing with `crypto.scrypt` and timing-safe verification.
- [ ] Implement `createUserWithPassword`, `verifyUserPassword`, `createDatabaseSession`, `revokeSession`.
- [ ] Update `readSessionIdFromRequest` flow so DB session becomes primary.
- [ ] Keep import-code/manual-key path as Sub2API key binding, not as primary auth.
- [ ] Implement `POST /api/auth/register`.
- [ ] Implement `POST /api/auth/login`.
- [ ] Implement `POST /api/auth/logout`.
- [ ] Update `GET /api/session` to return DB-backed authenticated shape.
- [ ] Ensure cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production.
- [ ] Tests: register success, duplicate email, login success, wrong password, expired session, logout, current session.
- [ ] Commit: `feat(auth): add database-backed registration and sessions`

**Acceptance:**

- [ ] `tests/api/auth.test.ts` passes.
- [ ] Existing session tests pass.
- [ ] No API returns secret fields (`passwordHash`, API key ciphertext).

---

## Cut 1: Migration Apply And DB Baseline Closure

**Goal:** Close the already-committed Workbench schema migration against a real database path before building higher layers.

**Files:**
- Modify: `docs/部署与回滚.md`

**Checklist:**

- [ ] Confirm local or staging-safe Postgres target.
- [ ] Run `pnpm prisma validate`.
- [ ] Run `pnpm prisma migrate deploy` against the chosen DB.
- [ ] Query old `image_tasks` rows and confirm nullable workbench columns do not break reads.
- [ ] Confirm `workbench_projects`, `creative_sessions`, `version_nodes` exist.
- [ ] Document apply result and fallback env in `docs/部署与回滚.md`.
- [ ] Commit: `docs: record workbench migration baseline`

**Acceptance:**

- [ ] Migration apply succeeds.
- [ ] Old task history API still returns old tasks.
- [ ] `PSYPIC_WORKBENCH_PROJECTS_STORE=indexeddb` fallback remains available.

---

## Cut 2: Workbench Domain Service

**Goal:** Add testable server-side domain operations for Project / CreativeSession / VersionNode before writing HTTP routes.

**Files:**
- Create: `lib/validation/workbench.ts`
- Create: `server/services/workbench-project-service.ts`
- Create: `server/services/creative-session-service.ts`
- Create: `server/services/version-node-service.ts`
- Test: `tests/api/workbench-service.test.ts`

**Checklist:**

- [ ] Define Zod inputs for project create/update/list.
- [ ] Define Zod inputs for creative session create/update/list.
- [ ] Define Zod inputs for version node create/update/list.
- [ ] Add Prisma client double pattern matching existing `image-task-service.ts` tests.
- [ ] Implement project list/create/get/update/delete scoped by user.
- [ ] Implement session list/create/get/update/delete scoped by project ownership.
- [ ] Implement version node list/create/get/update status scoped by session/project ownership.
- [ ] Serialize snake_case API output while keeping service internals idiomatic.
- [ ] Enforce cascade expectations: project delete removes sessions/nodes; tasks remain.
- [ ] Add pagination defaults and limits for list endpoints.
- [ ] Tests cover ownership, not found, ordering, cascade, branch meta fields.
- [ ] Commit: `feat(workbench): add project session and version node services`

**Acceptance:**

- [ ] Domain service tests pass without HTTP route handlers.
- [ ] Cross-user reads and writes are impossible at service boundary.

---

## Cut 3: Workbench REST API

**Goal:** Expose the Workbench domain through authenticated Next.js route handlers.

**Files:**
- Create: `app/api/workbench/projects/route.ts`
- Create: `app/api/workbench/projects/[projectId]/route.ts`
- Create: `app/api/workbench/sessions/route.ts`
- Create: `app/api/workbench/sessions/[sessionId]/route.ts`
- Create: `app/api/workbench/version-nodes/route.ts`
- Create: `app/api/workbench/version-nodes/[nodeId]/route.ts`
- Test: `tests/api/workbench-projects.test.ts`
- Test: `tests/api/workbench-sessions.test.ts`
- Test: `tests/api/workbench-version-nodes.test.ts`

**Checklist:**

- [ ] Add `requireCurrentUser(request)` helper if Cut 0 did not already centralize it.
- [ ] Implement store switch helper for `PSYPIC_WORKBENCH_PROJECTS_STORE`.
- [ ] `GET /api/workbench/projects`: list current user projects.
- [ ] `POST /api/workbench/projects`: create project.
- [ ] `GET /api/workbench/projects/[projectId]`: get one project.
- [ ] `PATCH /api/workbench/projects/[projectId]`: rename, collapse, reorder, active session.
- [ ] `DELETE /api/workbench/projects/[projectId]`: delete project.
- [ ] `GET /api/workbench/sessions?project_id=...`: list sessions.
- [ ] `POST /api/workbench/sessions`: create session.
- [ ] `PATCH /api/workbench/sessions/[sessionId]`: rename, pin, archive, custom label, last read.
- [ ] `DELETE /api/workbench/sessions/[sessionId]`: delete session.
- [ ] `GET /api/workbench/version-nodes?session_id=...`: list nodes.
- [ ] `POST /api/workbench/version-nodes`: create node.
- [ ] `GET /api/workbench/version-nodes/[nodeId]`: get node.
- [ ] `PATCH /api/workbench/version-nodes/[nodeId]`: update status / outputs / branch label.
- [ ] API tests cover `401`, `403`, `404`, `422`, `503`.
- [ ] Commit: `feat(api): add workbench CRUD routes`

**Acceptance:**

- [ ] Workbench API tests pass.
- [ ] `indexeddb` mode returns `503` with `Retry-After`.
- [ ] Route handlers contain HTTP concerns only; Prisma logic stays in services.

---

## Cut 4: Backend Sync Contract

**Goal:** Give the future frontend sync layer enough backend support for offline cache, outbox flush and conflict handling without implementing full UI sync yet.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/{ts}_workbench_sync_contract/migration.sql`
- Modify: `lib/validation/workbench.ts`
- Modify: `server/services/workbench-project-service.ts`
- Modify: `server/services/creative-session-service.ts`
- Modify: `server/services/version-node-service.ts`
- Create: `server/services/workbench-sync-service.ts`
- Create: `app/api/workbench/sync/route.ts`
- Test: `tests/api/workbench-sync.test.ts`

**Checklist:**

- [ ] Add `deletedAt` tombstone fields or equivalent deletion log for project/session/node.
- [ ] Add `clientMutationId` / idempotency storage if needed for batch writes.
- [ ] Support `updated_since` incremental list semantics.
- [ ] Implement batch pull endpoint: server changes since timestamp.
- [ ] Implement batch push endpoint: upsert project/session/node mutations.
- [ ] Enforce idempotent replay by `client_mutation_id`.
- [ ] Implement last-write-wins by server-accepted `updatedAt`.
- [ ] Return conflict payloads when client writes older than server state.
- [ ] Add payload size and operation count limits.
- [ ] Tests cover replay, partial failure, stale update, tombstone propagation.
- [ ] Commit: `feat(workbench): add backend sync contract`

**Acceptance:**

- [ ] A frontend outbox can safely retry the same mutation.
- [ ] Two devices editing the same row produce deterministic last-write-wins behavior.
- [ ] Deleted records can be removed from IndexedDB cache on the client.

---

## Cut 5: ImageTask To VersionNode Link

**Goal:** Make image generation and editing create traceable VersionNodes when a request includes workbench context.

**Files:**
- Modify: `lib/validation/image-params.ts`
- Modify: `app/api/images/generations/route.ts`
- Modify: `app/api/images/edits/route.ts`
- Modify: `server/services/image-task-service.ts`
- Modify: `server/services/version-node-service.ts`
- Test: `tests/api/image-generations.test.ts`
- Test: `tests/api/image-edits.test.ts`
- Test: `tests/api/workbench-version-nodes.test.ts`

**Checklist:**

- [ ] Add optional request fields: `project_id`, `session_id`, `parent_version_node_id`.
- [ ] Validate that project/session belong to current user.
- [ ] Keep old request body valid when no workbench context is present.
- [ ] Create `ImageTask` with nullable workbench fields when context exists.
- [ ] Create `VersionNode` with `queued` or `running` initial status.
- [ ] Link `ImageTask.versionNodeId` and VersionNode task relation consistently.
- [ ] On task success, update VersionNode `status=succeeded` and `outputAssetIds`.
- [ ] On task failure, update VersionNode `status=failed`.
- [ ] On cancel, update VersionNode `status=canceled`.
- [ ] Preserve `board_*` fields as optional pass-through only, no Board API.
- [ ] Tests cover old path, generation context path, edits context path, cross-user rejection.
- [ ] Commit: `feat(api): link image tasks to version nodes`

**Acceptance:**

- [ ] Every context-aware generation/edit has a traceable VersionNode.
- [ ] Legacy image API tests still pass.

---

## Cut 6: JobRuntimeEvent And Seven Statuses

**Goal:** Persist runtime state changes so Task Dock, history, retry and debugging can be backend-driven.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/{ts}_job_runtime_events/migration.sql`
- Modify: `lib/creator/types.ts`
- Modify: `server/services/image-task-service.ts`
- Modify: `server/services/image-job-queue-service.ts`
- Create: `server/services/job-runtime-event-service.ts`
- Create: `app/api/workbench/job-runtime-events/route.ts`
- Test: `tests/api/job-runtime-events.test.ts`
- Test: `tests/api/image-job-queue.test.ts`

**Checklist:**

- [ ] Add `JobRuntimeEvent` model and migration.
- [ ] Widen server task status union to include `timed_out` and `partial_image` where appropriate.
- [ ] Define event types: `queued`, `running`, `partial_image`, `succeeded`, `failed`, `canceled`, `timed_out`.
- [ ] Emit event when task is created.
- [ ] Emit event when task starts.
- [ ] Emit event for partial image stream payloads.
- [ ] Emit event on success with asset ids and usage summary.
- [ ] Emit event on failure with redacted error payload.
- [ ] Emit event on cancel.
- [ ] Emit event on timeout.
- [ ] Implement list API by `task_id`, `version_node_id`, cursor and limit.
- [ ] Tests cover event order and filtering.
- [ ] Commit: `feat(api): persist job runtime events`

**Acceptance:**

- [ ] A task lifecycle can be reconstructed from DB events.
- [ ] Task Dock frontend can be built from API output without reading memory queues.

---

## Cut 7: Operations, Audit And Safety

**Goal:** Make the new backend diagnosable and safe enough for staging and production rehearsal.

**Files:**
- Modify: `app/api/health/route.ts`
- Modify: `server/services/audit-log-service.ts`
- Modify: `server/services/api-response.ts`
- Modify: `docs/部署与回滚.md`
- Test: `tests/api/health.test.ts`
- Test: `tests/api/admin-runtime-settings.test.ts`

**Checklist:**

- [ ] Health check reports auth/session DB availability.
- [ ] Health check reports workbench store mode.
- [ ] Add audit events for login, logout, project delete, session delete, version node status override.
- [ ] Ensure request id flows through auth, workbench and image APIs.
- [ ] Add rate or payload guards for sync batch endpoint.
- [ ] Add explicit dangerous delete protections where request body confirmation is needed.
- [ ] Redact API keys, password hashes and upstream secrets in logs.
- [ ] Update rollback docs with backend store switches.
- [ ] Tests cover health output and audit writes.
- [ ] Commit: `feat(ops): add workbench auth health and audit coverage`

**Acceptance:**

- [ ] Operators can answer: auth works, DB works, workbench mode, latest failures.
- [ ] Sensitive data never appears in API responses or audit payloads.

---

## Cut 8: Staging Migration And Rollback Rehearsal

**Goal:** Prove the full backend can deploy, roll back and preserve old-user behavior.

**Files:**
- Modify: `docs/部署与回滚.md`

**Checklist:**

- [ ] Backup staging DB with `pg_dump`.
- [ ] Run `pnpm prisma migrate deploy`.
- [ ] Run `pnpm prisma validate`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Smoke register/login/logout.
- [ ] Smoke Workbench CRUD with two users and cross-user rejection.
- [ ] Smoke generation without workbench context.
- [ ] Smoke generation with workbench context.
- [ ] Smoke JobRuntimeEvent listing.
- [ ] Switch `PSYPIC_WORKBENCH_PROJECTS_STORE=indexeddb` and confirm Workbench API returns fallback response.
- [ ] Switch back to `database` and confirm API recovers.
- [ ] Record exact commands, timestamps, DB target and results in `docs/部署与回滚.md`.
- [ ] Commit: `docs: record backend max usable staging rehearsal`

**Acceptance:**

- [ ] Staging deploy path is documented and repeatable.
- [ ] Rollback path is documented and verified.
- [ ] Old V1.0 image generation path remains functional.

---

## Frontend Minimal Touch Boundary

This roadmap allows frontend to stay rough. Only these touchpoints are allowed before backend completion:

- `GET /api/session` shape alignment if Auth Cut 0 changes response fields.
- Optional: simple login/register pages or forms for manual smoke testing.
- Optional: pass `project_id/session_id/parent_version_node_id` from CreatorWorkspace once Cut 5 is ready.
- No Board Mode UI.
- No major ProjectSidebar redesign.
- No full IndexedDB sync UX until Cut 4 backend contract exists.

---

## Recommended Commit Order

1. `feat(auth): add database-backed registration and sessions`
2. `docs: record workbench migration baseline`
3. `feat(workbench): add project session and version node services`
4. `feat(api): add workbench CRUD routes`
5. `feat(workbench): add backend sync contract`
6. `feat(api): link image tasks to version nodes`
7. `feat(api): persist job runtime events`
8. `feat(ops): add workbench auth health and audit coverage`
9. `docs: record backend max usable staging rehearsal`

---

## Final Backend Gate

Run after Cut 0-8:

```bash
git diff --check
pnpm prisma validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Manual smoke:

- [ ] Register new user.
- [ ] Login.
- [ ] Bind Sub2API key through existing import/manual-key path.
- [ ] Create project.
- [ ] Create creative session.
- [ ] Create version node.
- [ ] Submit image generation without workbench context.
- [ ] Submit image generation with workbench context.
- [ ] Verify ImageTask links to VersionNode.
- [ ] Verify JobRuntimeEvent list shows lifecycle.
- [ ] Logout.
- [ ] Confirm private APIs return `401`.

---

## Stop Conditions

- Stop if Auth migration would require fake emails for existing users.
- Stop if Workbench API cannot enforce cross-user isolation at the service layer.
- Stop if ImageTask legacy path breaks.
- Stop if rollback requires deleting data.
- Stop if any task tries to implement Board Mode before this backend roadmap is complete.
