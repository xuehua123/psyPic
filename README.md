# PsyPic

PsyPic 是一个独立的 GPT Image 商业生图站，目标是先交付可公开试用的商业创作台，再逐步扩展到灵感社区、同款生成和完整素材/历史能力。

当前代码已完成 `v0.1-v1.0` 的主要产品切片，已经从 MVP 进入 V1 封板回归阶段：

- Next.js App Router + TypeScript 项目骨架。
- 桌面端三栏创作台和移动端底部参数入口。
- 本地设置页和手动 Sub2API key 开发模式入口。
- Sub2API import exchange、session、logout、manual key binding 的 BFF 契约雏形。
- AES-GCM key binding 加密、HttpOnly session cookie。
- Prisma 基础数据模型：User、Session、KeyBinding、AuditLog。
- 第一批商业模板和 prompt 种子库。
- GitHub Actions CI：lint、typecheck、test、Prisma validate、build、Playwright E2E。
- 文生图 Alpha：`/api/images/generations`、Sub2API Images API 代理、TempAsset 下载代理、本地基础历史、request id / usage / 耗时展示。
- 图生图：`/api/images/edits`、单参考图上传、拖拽/粘贴、继续编辑。
- `v0.5` 任务系统：任务状态查询、取消、失败/取消后重试、流式 partial preview、用户并发限制。
- `v0.6` 遮罩编辑最小闭环：遮罩画布、PNG mask 导出、BFF 校验和 Sub2API multipart 转发。
- `v0.7` 服务端历史接口：按当前 session 查询成功图片任务、分页、缩略图、usage 和 request id 追踪。
- `v0.7` 素材库接口与创作台入口：按图片资产列出素材，支持收藏、标签、搜索过滤，并补齐长期 Prisma 模型。
- `v0.7` 相册与批量下载：相册最小模型、素材详情接口、当前用户资产 ZIP 下载。
- `v0.7` 图片详情页：素材预览、参数/usage 展示、下载、回到创作台继续编辑。
- `v0.8` 模板 API：商业模板列表、scene 过滤、分页和结构化 Prompt 渲染接口。
- `v0.8` 创作台模板字段编辑：按模板字段填写产品、场景、风格和留白策略后应用到 Prompt。
- `v0.8` Prompt 助手：中文意图结构化为商业 brief，图生图自动补主体保留约束。
- `v0.8` Prompt 收藏：本地收藏常用 Prompt，并可从右侧面板一键套用。
- `v0.9` 社区最小发布 API：社区作品长期模型、发布接口、作品详情接口和同款生成隐私开关。
- `v0.9` 运营基础：当前用户用量汇总 API、运行时最大 `n` 限制和社区公开发布开关。
- `v0.9` 社区风控：作品举报接口和管理员下架接口。
- `v0.9` 创作台社区发布入口：从素材卡片发布作品，并控制可见性和隐私开关。
- `v1.0` 社区浏览基础：公开作品列表 API、灵感社区信息流页面和公开作品详情页。
- `v1.0` 社区同款入口：作品详情页生成同款草稿，并可回到创作台套用。
- `v0.9` 管理端：运行时配置文件持久化覆盖、usage 汇总、举报列表、下架/恢复/精选和审计日志。
- `v1.0` 社区互动：点赞、收藏、精选排序、标签筛选和详情页举报入口。
- `v1.0` 批量工作流：批量 Prompt、CSV 导入、多尺寸展开、批量任务状态和失败重试。
- `v1.0` 任务队列基础：in-memory job queue、queued/running/canceled/failed/timed_out 状态一致性，预留 Redis/DB-backed worker 替换边界。
- `v1.0` 图片能力补齐：多参考图、JPEG/WebP compression、自定义尺寸 16 倍数规整、长宽比和尺寸层级限制。
- 整站 UI 重构（plan slug `linear-stirring-acorn`）：CreatorWorkspace 4116 → 1593 行（-61%），17 子组件抽出 + Context 81 字段；shadcn/ui 收敛 Button × 32 / Input × 7 / Select × 8 / Checkbox × 12 / Slider × 1；Phase 6 暗色模式落地（亮 / 暗 / 跟随系统三态切换 + ThemeNoFlashScript 抗 FOUC + globals.css 全量 hex → CSS var 迁移）；Plan Task 6 移动端结构重排（工作台左 / 底 Sheet 抽屉、社区 chip 单行横滚、详情主图 ≤ 55vh CTA 首屏可达）。

## 技术栈

- Frontend / BFF：Next.js App Router、React、TypeScript
- UI：Tailwind v4 + shadcn/ui + lucide-react；CSS var 集中管理 light/dark token
- 表单与校验：React Hook Form、Zod
- 测试：Vitest、Testing Library、Playwright
- 数据模型：Prisma
- 包管理：pnpm

## 本地开发

安装依赖：

```bash
pnpm install
```

准备环境变量：

```bash
cp .env.example .env
```

运行时配置默认写入 `.data/runtime-settings.json`，审计日志默认写入 `.data/audit-logs.json`。生产环境可使用 `DATABASE_URL`，并设置 `PSYPIC_RUNTIME_SETTINGS_STORE=database`、`PSYPIC_AUDIT_LOG_STORE=database`，让 `runtime_settings` 和 `AuditLog` 走 Prisma/DB 持久化。

启动开发服务：

```bash
pnpm dev
```

默认访问：

```text
http://127.0.0.1:3000
```

## 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
pnpm load:smoke
pnpm build
```

首次运行 E2E 前安装 Chromium：

```bash
pnpm e2e:install
```

封板回归建议：

```bash
git diff --check
pnpm lint
pnpm typecheck
pnpm test
DATABASE_URL="postgresql://psypic:psypic@localhost:5432/psypic" pnpm prisma validate
pnpm build
pnpm e2e
APP_URL="http://127.0.0.1:3000" pnpm load:smoke
```

Prisma schema 校验示例：

```bash
DATABASE_URL="postgresql://psypic:psypic@localhost:5432/psypic" pnpm prisma validate
```

Windows PowerShell：

```powershell
$env:DATABASE_URL="postgresql://psypic:psypic@localhost:5432/psypic"; pnpm prisma validate
```

## 目录说明

```text
app/          Next.js App Router 页面和 BFF Route Handlers
components/   创作台、设置页和 UI 组件
lib/          参数校验、商业模板等前后端共享逻辑
server/       session、key binding、API response 等服务层
prisma/       Prisma 数据模型
docs/         产品、架构、实施计划和验收文档
tests/        单元测试、组件测试、API 契约测试和 E2E
```

## 安全边界

- 前端不直接调用 Sub2API。
- 前端不长期保存明文 API Key。
- API Key 不进入 URL、localStorage、sessionStorage 或 IndexedDB。
- import exchange 不返回 `api_key`。
- 生产日志必须脱敏 `Authorization`、`api_key` 和 `psypic_session`。

## 当前开发状态

项目当前处于 V1.0 代码封板期。核心功能、管理端、社区互动、批量工作流、任务队列基础、运行时配置持久化、图片参数边界、Playwright E2E、移动端 smoke 和生产 smoke/load 脚本已经实现；正式发布前仍需在目标 staging/production 环境完成真实 Sub2API launch ticket、对象存储、migration、压测和回滚演练。

生产部署和回滚步骤见 [docs/部署与回滚.md](docs/部署与回滚.md)。
