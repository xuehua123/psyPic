# PsyPic

PsyPic 是一个独立的 GPT Image 商业生图站，目标是先交付可公开试用的商业创作台，再逐步扩展到灵感社区、同款生成和完整素材/历史能力。

当前代码已完成 `v0.1-v0.3` Alpha 阶段：

- Next.js App Router + TypeScript 项目骨架。
- 桌面端三栏创作台和移动端底部参数入口。
- 本地设置页和手动 Sub2API key 开发模式入口。
- Sub2API import exchange、session、logout、manual key binding 的 BFF 契约雏形。
- AES-GCM key binding 加密、HttpOnly session cookie。
- Prisma 基础数据模型：User、Session、KeyBinding、AuditLog。
- 第一批商业模板和 prompt 种子库。
- GitHub Actions CI：lint、typecheck、test、Prisma validate、build。
- 文生图 Alpha：`/api/images/generations`、Sub2API Images API 代理、TempAsset 下载代理、本地基础历史、request id / usage / 耗时展示。

## 技术栈

- Frontend / BFF：Next.js App Router、React、TypeScript
- UI：CSS + lucide-react，后续可继续向 shadcn/ui 风格组件收敛
- 表单与校验：React Hook Form、Zod
- 测试：Vitest、Testing Library
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
pnpm build
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
tests/        单元测试、组件测试和 API 契约测试
```

## 安全边界

- 前端不直接调用 Sub2API。
- 前端不长期保存明文 API Key。
- API Key 不进入 URL、localStorage、sessionStorage 或 IndexedDB。
- import exchange 不返回 `api_key`。
- 生产日志必须脱敏 `Authorization`、`api_key` 和 `psypic_session`。

## 当前开发状态

项目仍处于 MVP 开发期。`v0.3` 已进入文生图 Alpha，可通过 BFF 调用 Sub2API 并下载生成结果。

下一阶段是 `v0.4` 图生图和公开试用 MVP：

- 实现 `/api/images/edits`。
- 支持单参考图上传和继续编辑。
- 完成商业尺寸预设和单目标尺寸生成/下载。
- 补齐 Playwright E2E 与手工浏览器验收。
- 回归 MVP 验收清单。
