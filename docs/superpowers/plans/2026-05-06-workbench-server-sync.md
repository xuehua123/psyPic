# Phase B · 工作台数据服务端化 Implementation Plan

> 把现有 IndexedDB local-first 的 Project / Session / Branch / VersionNode 升级为「server 优先 + IndexedDB offline cache」，让用户跨设备 / 跨浏览器都能拿到同一份工作台状态。同时把 in-memory Job runtime 升级为可持久化的 JobRuntimeEvent 流。

**Goal**：把 docs/07「图片工作台化验收」前 6 项 `[ ]` → `[x]`。

**Scope**：仅基建。不动 UI 主流程（除 sync layer 接入点）。不动 Sub2API 协议。不动 Board Mode（留 Phase C）。

**出口**：
- Prisma 三件套（WorkbenchProject / CreativeSession / VersionNode）+ 双轨开关 `PSYPIC_WORKBENCH_PROJECTS_STORE`
- `/api/workbench/*` API 完整 CRUD
- `lib/creator/projects-store.ts` + `version-graph.ts` 改造为 server-first + offline cache
- `image_tasks` 表加 nullable `project_id` / `session_id` / `version_node_id` 字段
- JobRuntimeEvent 入库 + Task Dock 7 状态完整
- staging migration 通过 + 回滚通路验证

**预计周期**：2-3 周（最大不确定点是 Cut 3 sync layer）。

---

## 关键设计决定

### 决定 1：server 优先 + IndexedDB 降级为 offline cache

不是 schema-only 半服务端化（那会产生「本地改了 server 没改」的脏数据问题）。具体策略：

- **写**：默认走 server（POST/PATCH `/api/workbench/*`）；网络失败时落本地 outbox queue，恢复后批量 flush
- **读**：先读本地 cache（IndexedDB）→ 后台拉 server → diff merge → 更新 cache + UI
- **冲突解决**：last-write-wins by `updated_at`（第一版够用；后续如有协作再升级）
- **离线模式**：完全本地操作，挂 outbox 等恢复

### 决定 2：双轨开关 = 部署回退能力，不是产品功能

`PSYPIC_WORKBENCH_PROJECTS_STORE=indexeddb|database`：

- `database`（默认）：API 走 Prisma，IndexedDB 仅作 offline cache
- `indexeddb`：API 路由返回 410 Gone 或 503 Service Unavailable，前端完全 fallback 本地（与 V1.0 行为一致）
- 用途：migration 失败时**运维侧**一键回退；不暴露给最终用户

### 决定 3：image_tasks 关联字段全 nullable

旧任务（V1.0 时期生成的）保持 `project_id = NULL` —— 它们不属于任何 workbench project，工作台显示时归到「未分类」桶或不显示。**绝不**写迁移脚本回填假数据。

---

## 前置依赖

| # | 依赖 | 状态 | 检查方式 |
|---|---|---|---|
| 1 | Phase A 完成（v1.0 tag 在） | 🚧 | `git tag -l v1.0` |
| 2 | staging Postgres 可用 | ✅ Phase A Cut 2 已建 | 同上 |
| 3 | 本地 Postgres（可选，否则用 SQLite shim） | 🚧 | `docker ps` 看 psypic_db |

---

## Cut 1：Prisma 三件套 + migration

**Files**:
- Modify: `prisma/schema.prisma`（+3 model + image_tasks 加 3 字段 + version_node_status enum）
- Create: `prisma/migrations/{timestamp}_workbench_models/migration.sql`（自动生成）
- Modify: `.env.example`（+ `PSYPIC_WORKBENCH_PROJECTS_STORE=database`）
- Modify: `docs/部署与回滚.md`（确认 env 已有）

**Schema（按 docs/13 字段）**：

```prisma
model WorkbenchProject {
  id              String           @id
  userId          String           @map("user_id")
  title           String
  sortOrder       Int              @default(0) @map("sort_order")
  collapsed       Boolean          @default(false)
  activeSessionId String?          @map("active_session_id")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")
  user            User             @relation(fields: [userId], references: [id])
  sessions        CreativeSession[]
  versionNodes    VersionNode[]
  imageTasks      ImageTask[]
  @@index([userId, sortOrder])
  @@map("workbench_projects")
}

model CreativeSession {
  id                       String           @id
  projectId                String           @map("project_id")
  title                    String
  forkParentVersionNodeId  String?          @map("fork_parent_version_node_id")
  activeVersionNodeId      String?          @map("active_version_node_id")
  createdAt                DateTime         @default(now()) @map("created_at")
  updatedAt                DateTime         @updatedAt @map("updated_at")
  project                  WorkbenchProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  versionNodes             VersionNode[]
  imageTasks               ImageTask[]
  @@index([projectId, updatedAt])
  @@map("creative_sessions")
}

enum VersionNodeStatus {
  queued
  running
  succeeded
  failed
  canceled
  timed_out
}

model VersionNode {
  id                    String              @id
  projectId             String              @map("project_id")
  sessionId             String              @map("session_id")
  parentVersionNodeId   String?             @map("parent_version_node_id")
  taskId                String?             @unique @map("task_id")
  promptSnapshot        String              @map("prompt_snapshot")
  paramsSnapshot        Json                @map("params_snapshot")
  sourceAssetIds        Json                @map("source_asset_ids")
  outputAssetIds        Json                @map("output_asset_ids")
  boardDocumentId       String?             @map("board_document_id")
  boardSnapshot         Json?               @map("board_snapshot")
  boardExportAssetId    String?             @map("board_export_asset_id")
  branchLabel           String?             @map("branch_label")
  status                VersionNodeStatus
  createdAt             DateTime            @default(now()) @map("created_at")
  project               WorkbenchProject    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  session               CreativeSession     @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  task                  ImageTask?          @relation(fields: [taskId], references: [id])
  parent                VersionNode?        @relation("VersionParent", fields: [parentVersionNodeId], references: [id])
  children              VersionNode[]       @relation("VersionParent")
  @@index([sessionId, createdAt])
  @@index([projectId, createdAt])
  @@map("version_nodes")
}

// ImageTask 加 3 个 nullable 字段
model ImageTask {
  // ...既有字段...
  projectId       String?            @map("project_id")
  sessionId       String?            @map("session_id")
  versionNodeId   String?            @unique @map("version_node_id")
  project         WorkbenchProject?  @relation(fields: [projectId], references: [id])
  session         CreativeSession?   @relation(fields: [sessionId], references: [id])
  versionNode     VersionNode?       @relation
}
```

**Steps**:
- [ ] **Step 1.1** 写 schema 改动（不要 commit）
- [ ] **Step 1.2** `pnpm prisma format && pnpm prisma validate` 通过
- [ ] **Step 1.3** 本地 Postgres 跑 `pnpm prisma migrate dev --name workbench_models`，确认 migration SQL 正确（特别是 image_tasks 加列必须 `ALTER TABLE ... ADD COLUMN ... NULL` 不能 NOT NULL）
- [ ] **Step 1.4** review migration.sql：所有 ALTER TABLE 不带 DEFAULT；所有 FK 都允许 NULL
- [ ] **Step 1.5** 本地 `pnpm prisma migrate reset` 重跑一遍（验证幂等）
- [ ] **Step 1.6** commit 1：`feat(prisma): 加 WorkbenchProject / CreativeSession / VersionNode + ImageTask 关联字段（Phase B · Cut 1）`

**验收**：
- [ ] `pnpm prisma validate` 通过
- [ ] 本地 migration apply 成功
- [ ] V1.0 老数据（image_tasks 无 project_id）查询不报错
- [ ] schema diff CI 通过

---

## Cut 2：API CRUD + 服务层

**Files**:
- Create: `app/api/workbench/projects/route.ts`（GET list + POST create）
- Create: `app/api/workbench/projects/[projectId]/route.ts`（GET / PATCH / DELETE）
- Create: `app/api/workbench/sessions/route.ts`（POST create + GET list by project）
- Create: `app/api/workbench/sessions/[sessionId]/route.ts`（PATCH / DELETE）
- Create: `app/api/workbench/version-nodes/route.ts`（POST create + GET list by session）
- Create: `app/api/workbench/version-nodes/[nodeId]/route.ts`（GET / PATCH status）
- Create: `server/services/workbench-project-service.ts`
- Create: `server/services/version-node-service.ts`
- Create: `lib/validation/workbench.ts`（Zod schemas）
- Test: `tests/api/workbench-projects.test.ts`
- Test: `tests/api/workbench-sessions.test.ts`
- Test: `tests/api/workbench-version-nodes.test.ts`

**契约要点**：
- 所有路由强制 session 鉴权；仅当前用户的 project / session / version-node 可读写
- 删除 project 级联删除 session / version-node（Prisma onDelete Cascade）
- 删除 session 级联删除 version-node，但**不删除** ImageTask（task 是计费 / 审计实体，独立保留）
- 双轨开关：`PSYPIC_WORKBENCH_PROJECTS_STORE` 不为 `database` 时所有路由返回 503 + `Retry-After`，前端 fallback 本地

**Steps**:
- [ ] **Step 2.1** 写 Zod schemas（`lib/validation/workbench.ts`）
- [ ] **Step 2.2** 写 service 层（仅 Prisma 操作，不含 HTTP）
- [ ] **Step 2.3** 失败测试：API 路由的鉴权 / 跨用户访问 / 双轨开关 / 级联删除
- [ ] **Step 2.4** 实现 6 个 route handler
- [ ] **Step 2.5** 跑测试通过
- [ ] **Step 2.6** commit 2：`feat(api): /api/workbench/{projects,sessions,version-nodes} CRUD（Phase B · Cut 2）`

**验收**：
- [ ] 三套 API 测试通过
- [ ] 跨用户访问 403
- [ ] 未登录 401
- [ ] 双轨开关 indexeddb 模式返回 503

---

## Cut 3：sync layer（最大不确定点）

**Files**:
- Create: `lib/creator/sync/sync-types.ts`（pending op / outbox 类型）
- Create: `lib/creator/sync/sync-engine.ts`（核心：read-through / write-through / outbox flush）
- Create: `lib/creator/sync/conflict-resolver.ts`（last-write-wins by updated_at）
- Modify: `lib/creator/projects-store.ts`（IndexedDB 操作改为 cache 接口）
- Modify: `lib/creator/use-projects.ts`（接 sync-engine）
- Modify: `lib/creator/version-graph.ts`（同上：node CRUD 走 sync layer）
- Test: `tests/unit/sync-engine.test.ts`（覆盖：online write / offline outbox / conflict / flush 重试）
- Test: `tests/unit/conflict-resolver.test.ts`

**核心数据流**（写）：

```
useProjects.createProject(input)
  → sync-engine.write({ kind: 'project.create', payload })
      ├─ 立即写 IndexedDB cache（optimistic UI）
      ├─ 立即 enqueue outbox
      └─ 异步 fetch POST /api/workbench/projects
          ├─ 成功 → outbox dequeue + 用 server 返回的 id 替换 cache 临时 id
          └─ 失败 → outbox 保留，下次网络恢复重试
```

**核心数据流**（读）：

```
useProjects() mount
  → 立即返回 IndexedDB cache（避免 loading flicker）
  → 后台 fetch GET /api/workbench/projects
      ├─ server 返回 → conflict-resolver merge
      └─ merge 结果 → 更新 cache + setState
```

**Steps**:
- [ ] **Step 3.1** 先写一份 50 行的原型脚本验证 conflict 策略：3 个 op（local create + remote create + local update）跑过 conflict-resolver 出符合预期的结果
- [ ] **Step 3.2** 写 sync-engine 失败测试（5 场景：online OK / offline outbox / network 5xx 重试 / conflict 解决 / 启动时 cache → server merge）
- [ ] **Step 3.3** 实现 sync-engine
- [ ] **Step 3.4** projects-store / version-graph 改造（保持 hook API 签名不变，让 ProjectSidebar / CreatorWorkspace 不需要改）
- [ ] **Step 3.5** 跑全套既有 ProjectSidebar / CreatorWorkspace 测试：必须不破
- [ ] **Step 3.6** commit 3：`feat(creator): sync layer（IndexedDB → server，offline outbox + last-write-wins）（Phase B · Cut 3）`

**关键不变量**：
- hook API 签名不变（`useProjects`、`useBranchMeta`、`useVersionGraph`）
- offline 时所有操作仍可用
- 双轨开关 indexeddb 模式时 sync-engine 完全跳过 fetch
- 临时 id（client 生成的 uuid）在 server 返回后必须 atomic 替换

**风险**：
- conflict-resolver 在 BranchMeta 字段上特别容易出错（4 个独立字段都可能 last-write-wins）—— 单测要覆盖每个字段
- 离线 outbox 长期堆积可能撑爆 IndexedDB —— 加 outbox 上限 1000 条，超出告警

**验收**：
- [ ] sync-engine + conflict-resolver 单测通过
- [ ] ProjectSidebar / CreatorWorkspace 既有测试 0 红
- [ ] 手动验证：离线创建 project → 上线 → server 出现该 project
- [ ] 手动验证：两浏览器同时改同一 project title → 后写赢

---

## Cut 4：image_tasks 关联 + 生成接口写 VersionNode

**Files**:
- Modify: `app/api/images/generations/route.ts`（接受 `project_id` / `session_id` / `parent_version_node_id`，调用 version-node-service 写 node）
- Modify: `app/api/images/edits/route.ts`（同上）
- Modify: `server/services/image-task-service.ts`（创建 task 时关联 project / session / version_node）
- Modify: `server/services/version-node-service.ts`（task succeeded 时 patch version-node status + outputAssetIds）
- Modify: `components/creator/CreatorWorkspace.tsx`（提交时带 `project_id` / `session_id`）
- Test: `tests/api/image-generations.test.ts`（既有，加 workbench 关联用例）
- Test: `tests/api/image-edits.test.ts`（同上）

**契约**：
- 提交生成 / edits 请求时**可选**带 `project_id` + `session_id`：
  - 都带 → 创建 ImageTask 同时创建 VersionNode（status=queued / running），关联三方
  - 都不带 → 老路径，task 不关联（保持 V1.0 兼容）
- task 状态变化 → version-node 状态同步（image-task-service 内部保持原子）

**Steps**:
- [ ] **Step 4.1** Zod schema 加 optional `project_id` / `session_id` / `parent_version_node_id`
- [ ] **Step 4.2** 失败测试：带 workbench context 提交 → 数据库出现 VersionNode + ImageTask.versionNodeId 关联
- [ ] **Step 4.3** 实现：image-task-service 接受可选 workbench context
- [ ] **Step 4.4** CreatorWorkspace 提交时从 CreatorStudioContext 取当前 project / session / parent node
- [ ] **Step 4.5** 跑全套测试
- [ ] **Step 4.6** commit 4：`feat(api): images/{generations,edits} 关联 workbench context + VersionNode（Phase B · Cut 4）`

**验收**：
- [ ] 不带 workbench context 提交：行为不变（V1.0 兼容）
- [ ] 带 workbench context 提交：DB 出现 VersionNode + ImageTask 关联
- [ ] task 失败 → version-node status=failed
- [ ] task canceled → version-node status=canceled

---

## Cut 5：JobRuntimeEvent + Task Dock 7 状态完整

**Files**:
- Modify: `prisma/schema.prisma`（+ JobRuntimeEvent model）
- Create: `prisma/migrations/{ts}_job_runtime_events/migration.sql`
- Modify: `server/services/image-job-queue-service.ts`（每次状态变化写 event）
- Create: `app/api/workbench/job-runtime-events/route.ts`（GET stream / list by task / version-node）
- Modify: `components/creator/studio/TaskStatusStrip.tsx`（展示 7 状态全集）
- Create: `components/creator/studio/TaskDockSection.tsx`（新组件 - 全局任务 dock）
- Test: `tests/api/job-runtime-events.test.ts`
- Test: `tests/components/task-dock.test.tsx`

**JobRuntimeEvent schema**（按 docs/13）：

```prisma
model JobRuntimeEvent {
  id            String       @id
  taskId        String       @map("task_id")
  versionNodeId String?      @map("version_node_id")
  eventType     String       @map("event_type")  // queued/running/partial_image/succeeded/failed/canceled/timed_out
  payload       Json
  createdAt     DateTime     @default(now()) @map("created_at")
  task          ImageTask    @relation(fields: [taskId], references: [id])
  @@index([taskId, createdAt])
  @@index([versionNodeId, createdAt])
  @@map("job_runtime_events")
}
```

**Steps**:
- [ ] **Step 5.1** schema + migration
- [ ] **Step 5.2** image-job-queue-service 改造：所有状态变更都 emit event 写库
- [ ] **Step 5.3** 失败测试：events API + TaskDock 7 状态渲染
- [ ] **Step 5.4** 实现 TaskDockSection（按 docs/03 「底部 Task Dock」语义）
- [ ] **Step 5.5** Inspector 接 JobRuntimeEvent 列表（只读，按 task / node 过滤）
- [ ] **Step 5.6** commit 5：`feat(api): JobRuntimeEvent 入库 + TaskDock 7 状态（Phase B · Cut 5）`

**验收**：
- [ ] 提交生成 → DB 出现 queued / running / succeeded 3 个 event
- [ ] 取消 → 出现 canceled event
- [ ] 超时 → 出现 timed_out event
- [ ] TaskDock 7 状态都可见且可重试 / 取消

---

## Cut 6：staging migration + rollback 通路验证

**Files**:
- Modify: `docs/部署与回滚.md`（新增「Phase B migration 演练记录」章节）

**Steps**:
- [ ] **Step 6.1** staging 备份当前 DB（`pg_dump`）
- [ ] **Step 6.2** staging 跑 `pnpm prisma migrate deploy`
- [ ] **Step 6.3** 验证：老 image_tasks 查询不报错；老用户进入工作台不报错
- [ ] **Step 6.4** 模拟 migration 失败：把 `PSYPIC_WORKBENCH_PROJECTS_STORE` 切回 `indexeddb`，验证前端完全 fallback 本地（V1.0 行为）
- [ ] **Step 6.5** 切回 `database`，验证 sync-engine 正常工作
- [ ] **Step 6.6** 把演练过程记录到 `docs/部署与回滚.md`
- [ ] **Step 6.7** commit 6：`docs: Phase B migration + rollback 演练通过（Phase B · Cut 6）`

**验收**：
- [ ] migration apply + rollback 双向通
- [ ] 双轨开关切换不丢用户数据
- [ ] 老 V1.0 用户体验不受影响

---

## 全局验收闸

Cut 1-6 完成后跑：

```bash
git diff --check
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma validate
pnpm build
pnpm e2e
```

docs/07 图片工作台化验收前 6 项全部 `[ ]` → `[x]`：
- [ ] Project Sidebar 中项目位置稳定
- [ ] 项目、会话、版本节点、素材和任务能被同一工作台上下文串起来
- [ ] 每次生成、编辑、同款和批量展开都会形成可追溯版本节点
- [ ] 恢复参数不会删除原节点；从旧节点分叉不会覆盖后续历史
- [ ] Task Dock 能展示 queued / running / partial / succeeded / failed / canceled / timed_out
- [ ] running/queued 任务可取消；failed/canceled/timed_out 可重试

---

## 不允许的捷径

- 写 migration 时给 image_tasks 老数据回填假 project_id
- 用 in-memory mock 代替真 Postgres 跑 migration 测试
- sync-engine 直接接服务端，不走 outbox（offline 体验会破）
- 在 sync layer 没稳定前同时改 UI 主流程
- 跳过 Cut 6 staging 演练直接上生产

## 经验预告（填完后补）

1. sync-engine 哪里超出预期复杂
2. 双轨开关在 staging 切换的真实体验
3. JobRuntimeEvent 体量增长速度（每天每用户多少条）
