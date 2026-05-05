# Phase A · V1.0 真封板 Implementation Plan

> **For agentic workers:** 本 plan 目标是清理 V1.0 代码封板后仍挂在 docs/07 上的 2 项 `[ ]`（staging/production 压测 + 回滚演练），并完成 6 路由 × 3 主题 × 2 端（桌面 / 移动）= 18 格真机走查。完成后打 `v1.0` tag 作为未来 V1.1+ 的 known-good baseline。

**Goal**：把「代码封板」升级到「生产封板」。

**Scope**：不开新功能。不改 Prisma schema。不改业务代码（除非走查发现 ⚠️ 需要修）。

**出口**：`v1.0` tag 打上；docs/07 最终封板验收全部 `[x]`；`docs/部署与回滚.md` 加一节「演练记录」。

---

## 前置依赖（开工前需到位）

| # | 依赖 | 状态 | 获取方式 |
|---|---|---|---|
| 1 | staging 域名 + APP_URL | 🚧 需确认 | 部署到 Vercel / Cloudflare Pages / 自建，记 URL |
| 2 | staging DATABASE_URL（Postgres） | 🚧 需确认 | 可用 Neon / Supabase / 自建，跑 `pnpm prisma migrate deploy` |
| 3 | 测试 Sub2API launch ticket | 🚧 需确认 | 从 Sub2API 管理台生成一个测试额度 key |
| 4 | 生产对象存储凭证（R2 / S3 / MinIO） | 🚧 需确认 | access key + secret + bucket + region |
| 5 | 测试 session cookie（压测生成链路用） | 🚧 需确认 | staging 导入 ticket 后从 DevTools 复制 `psypic_session` |

**Claude 在任一项未到位时不应继续**。Cut 1-5 都列出了各自的前置条件；缺哪个跳哪个。

---

## Cut 1：真机走查 6 路由 × 18 格

**Files**：
- Modify: `docs/17-测试与验收用例.md`（回填 18 格走查日志 + 发现的 ⚠️）
- Optionally modify: 走查中发现的 UI 文件（仅修 ⚠️，不开新功能）

**前置**：本地能跑 `pnpm dev` 进 `http://127.0.0.1:3000`；准备桌面 Chrome + 移动 viewport 或真手机。

**步骤**：
- [ ] **Step 1.1** 本地开发服务起来，确认 6 路由都可进：`/` / `/community` / `/community/works/[workId]` / `/library/[assetId]` / `/settings` / `/admin`（admin 需要有管理员 session）
- [ ] **Step 1.2** 按 `docs/17-测试与验收用例.md` 第 1099-1246 行「桌面 + 移动端人工走查（封板前）」逐项打钩
- [ ] **Step 1.3** 每路由 × 3 主题 × 2 端 = 18 张截图，命名 `{route}-{light|dark|system}-{desktop|mobile}.png`，放 `tmp/walkthrough-2026-05-06/`（tmp/ 不入仓库，但 18 格日志入仓库）
- [ ] **Step 1.4** 把 docs/17 第 1235-1242 行「走查日志（18 格）」表格填满：每格 ✅ / ⚠️ + 一句话
- [ ] **Step 1.5** ⚠️ 项目逐个修掉（每个 ⚠️ 一个独立 commit）
- [ ] **Step 1.6** 修完后重走一遍对应格子，确认全 ✅

**不允许**：跳过走查。不允许「代码看起来没问题就算」—— 本 cut 的全部价值是真机发现的视觉 bug。

**验收**：
- [ ] 18 格走查日志全 ✅
- [ ] 任何 ⚠️ 都有对应 commit 修掉
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 通过

---

## Cut 2：staging 压测

**Files**：
- Modify: `docs/部署与回滚.md`（新增「压测演练记录」章节）
- 可能 modify: `scripts/load-smoke.mjs`（若压测中发现脚本缺项）

**前置**：依赖 1 + 2 + 3 + 5 到位。

**步骤**：
- [ ] **Step 2.1** 用 `pnpm build && pnpm start` 或部署产物跑 staging（本 plan 不规定部署工具，用现有 CI / 手动均可）
- [ ] **Step 2.2** 导入测试 ticket 到 staging，确认 `/api/session` 返回正常 + 生成 1 张小图能跑通
- [ ] **Step 2.3** 本地只读 dry-run：`APP_URL=https://staging.example.com pnpm load:smoke`（不带 cookie，只压 health + community 3 个排序）
  - 预期：4 个 step 各 20 次请求，p95 < 2s，全部 2xx
- [ ] **Step 2.4** 带 cookie + library：`APP_URL=... PSYPIC_LOAD_COOKIE="psypic_session=..." pnpm load:smoke`
- [ ] **Step 2.5** 压生成链路（**用测试 key 和测试 bucket**，docs/部署已警告勿用生产 key）：
  ```bash
  APP_URL=https://staging.example.com \
  PSYPIC_LOAD_COOKIE="psypic_session=..." \
  PSYPIC_LOAD_RUN_GENERATION=true \
  PSYPIC_LOAD_REQUESTS=10 \
  PSYPIC_LOAD_CONCURRENCY=2 \
  pnpm load:smoke
  ```
- [ ] **Step 2.6** 把 p50 / p95 / 错误率记录到 `docs/部署与回滚.md` 新增「压测演练记录」章节
- [ ] **Step 2.7** 若 p95 超 5s 或错误率 > 1%，开 issue 跟进；阻塞 `v1.0` tag

**验收**：
- [ ] 4 条压测命令全跑过
- [ ] 压测演练记录入仓库
- [ ] 错误率 < 1%，p95 < 5s

---

## Cut 3：生产对象存储真接

**Files**：
- Modify: `.env.example`（若发现缺项）
- Modify: `docs/部署与回滚.md`（新增「对象存储接入记录」章节：选型理由 + prefix 规划）
- 不改业务代码（S3 client 已在 package.json）

**前置**：依赖 1 + 4 到位。

**步骤**：
- [ ] **Step 3.1** 选一个 provider：Cloudflare R2（推荐，S3 兼容 + 零出口费）/ AWS S3 / MinIO 自建
- [ ] **Step 3.2** 在选定 provider 建 bucket，按 docs/部署要求设置三种 prefix：
  - `psypic/temp/`（TempAsset，TTL 72h）
  - `psypic/assets/`（长期 ImageAsset）
  - `psypic/community/`（社区公开图）
- [ ] **Step 3.3** 建最小权限 access key：仅允许 read / write / delete 上述 3 个 prefix，不给 bucket 管理权限
- [ ] **Step 3.4** 在 staging 配置 env：`ASSET_STORAGE_DRIVER=s3`（或 `r2` / `minio`）+ endpoint / region / bucket / prefix / access key / secret
- [ ] **Step 3.5** 重启 staging，导入 ticket，生成 1 张图，确认：
  - 图片落到对象存储的 `psypic/temp/` 前缀
  - `GET /api/assets/{asset_id}` 能读回
  - 72h 后 temp asset 可以清理（手动触发 TTL 脚本或等自动清理）
- [ ] **Step 3.6** 把选型理由 + prefix 规划 + 权限范围写到 `docs/部署与回滚.md` 新增「对象存储接入记录」章节

**验收**：
- [ ] staging 生成的图真落在对象存储
- [ ] signed URL / BFF 代理能读回
- [ ] access key 只有 3 个 prefix 的最小权限

---

## Cut 4：回滚演练

**Files**：
- Modify: `docs/部署与回滚.md`（新增「回滚演练记录」章节：时间 / 执行人 / 上一版 tag / 回滚命令 / 健康检查结果）

**前置**：依赖 1 + 2 + 4 到位；staging 已有至少 2 个可切换的部署产物。

**步骤**：
- [ ] **Step 4.1** 在 staging 打一个 `v0.9-final` tag 或记录当前部署 id 为 `previous-stable`
- [ ] **Step 4.2** 部署 `v1.0-rc` 到 staging
- [ ] **Step 4.3** 验证 `/api/health`、生成 1 张图、浏览社区，确认新版工作
- [ ] **Step 4.4** 模拟「发现问题」：立即切回 `previous-stable`（部署工具的 rollback 命令 / 重新部署旧镜像 tag / 切 symlink）
- [ ] **Step 4.5** 回滚后再跑一次 `/api/session` + 生成接口 + 社区列表健康检查
- [ ] **Step 4.6** 再切回 `v1.0-rc`
- [ ] **Step 4.7** 把全过程（时间 / 命令 / 结果）记录到 `docs/部署与回滚.md` 新增「回滚演练记录」章节
- [ ] **Step 4.8** 如果演练中发现 rollback 命令不可用 / 数据库 migration 阻塞回滚 / 对象存储数据丢失：阻塞 `v1.0` tag，开 issue 修

**验收**：
- [ ] 至少成功演练一次「上线 → 回滚 → 再上线」
- [ ] 回滚后 3 项健康检查全通
- [ ] 演练记录入仓库

---

## Cut 5：v1.0 tag + release notes

**Files**：
- Modify: `docs/07-验收清单.md`（最终封板 2 项 `[ ]` → `[x]`：staging/production 压测通过、生产部署和回滚方案通过演练）
- Modify: `CHANGELOG.md`（若无则 create；记录 v1.0 范围）
- 打 `v1.0` git tag

**前置**：Cut 1-4 全部 ✅。

**步骤**：
- [ ] **Step 5.1** 基于 `git log v0.9..HEAD --oneline` 起草 v1.0 release notes（可先放 `tmp/release-notes-v1.0.md`），分：
  - 主功能（创作 / 编辑 / 流式 / 任务队列 / 遮罩 / 素材库 / 模板 / 社区 / 批量）
  - UI 重构（Phase 0-8 + 暗色 + 移动端 + Sidebar 平铺折叠 + SessionRowMenu 完结）
  - 数据底座（Prisma 17 model + 运行时配置 + 审计日志）
  - E2E / 压测 / 回滚演练
- [ ] **Step 5.2** 勾掉 docs/07 最终封板 2 项 `[ ]`
- [ ] **Step 5.3** commit：`docs: v1.0 最终封板（压测 + 回滚演练通过）`
- [ ] **Step 5.4** push main
- [ ] **Step 5.5** `git tag -a v1.0 -m "PsyPic V1.0 封板"`
- [ ] **Step 5.6** `git push origin v1.0`
- [ ] **Step 5.7** 在 GitHub release 页面贴 release notes，可选附 18 格走查截图压缩包

**不允许**：
- 跳过 Cut 1-4 任意一项直接打 tag
- 打 `v1.0` 前 CI 未通过
- Release notes 只列 commit hash 不写说明

**验收**：
- [ ] `v1.0` tag 在 origin 可见
- [ ] docs/07 最终封板全 `[x]`
- [ ] GitHub release 有 notes

---

## 全局验收闸

所有 Cut 完成后跑一次最终闸：

```bash
git diff --check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
# staging 压测
APP_URL=<staging> pnpm load:smoke
```

全绿 → 打 tag。任何一项红 → 不打 tag，开 issue 修。

## 不允许的捷径

- 用「看起来没问题」代替真机走查
- 用生产 key 压测
- 跳过回滚演练直接打 tag
- 在 `main` 强推导致 staging / 生产状态漂移
- 本 Phase 引入任何新依赖或新功能

## 经验预告（填完后补）

待 Cut 1-5 走完后回填：

1. 走查中最 surprising 的 ⚠️ 是什么
2. 压测中性能瓶颈点
3. 回滚中最容易被低估的环节
