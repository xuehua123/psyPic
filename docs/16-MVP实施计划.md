# 16. MVP 实施计划

## 目标

本计划原始范围覆盖 `v0.1-v0.4` 公开试用 MVP；当前已进入 `v0.5` 任务系统增强：

- 独立 PsyPic 创作台可部署。
- 支持 Sub2API 一键安全导入。
- 支持文生图、图生图、单参考图。
- 支持商业尺寸预设和单目标尺寸生成/下载。
- 支持基础历史、继续编辑、结果下载、错误提示、usage 展示。
- 密钥不进入 URL、日志、localStorage 或前端长期明文存储。

不在 MVP：

- 流式 partial preview。
- 多参考图。
- 遮罩编辑。
- 服务端完整素材库。
- 完整灵感社区。
- 批量多尺寸。
- 支付和会员系统。

## 前置确认

开工前确认：

- 是否接受默认技术栈：Next.js App Router + TypeScript + BFF Route Handlers。
- ORM 使用 Prisma 还是 Drizzle。
- 本地开发是否使用 PostgreSQL + Redis。
- TempAsset 临时文件落点：本地临时目录、Redis blob、R2/S3 临时 bucket 三选一。
- 手动 API Key 模式是否只用于开发。
- `v0.4` 是否必须部署公网试用。

默认选择：

- ORM：Prisma。
- TempAsset：本地开发用临时目录，生产用 R2/S3 临时前缀。
- 手动 Key：开发和调试可用，生产默认隐藏或放高级设置。

## 当前开发状态

更新时间：2026-05-01

- 已完成并推送：`v0.1`、`v0.2`、`v0.3` 文生图 Alpha、`v0.4` 图生图与公开试用 MVP。
- 本轮已完成：`v0.5` 任务状态查询/取消接口、同步生成任务记录、创作台任务状态展示、取消、重新生成、partial preview 和用户并发限制。
- 已完成 CI：GitHub Actions 执行 lint、typecheck、test、Prisma validate、build。
- 当前主线：`main`。
- 当前焦点：继续 `v0.5` 任务队列和 E2E 回归。

## 版本拆分

| 版本 | 状态 | 目标 | 交付物 |
| --- | --- | --- | --- |
| `v0.1` | 已完成 | 项目骨架和创作台静态闭环 | UI shell、参数面板、结果区、设置页 |
| `v0.2` | 已完成 | Sub2API 导入和 BFF 安全边界 | session、key binding、import exchange、手动 key |
| `v0.3` | 已完成 | 文生图可用 | `/api/images/generations`、TempAsset、下载、基础历史 |
| `v0.4` | 已完成 | 图生图和公开试用 MVP | `/api/images/edits`、单参考图、继续编辑、MVP 验收 |
| `v0.5` | 进行中 | 流式和任务系统 | 任务状态、取消、重试、SSE partial preview、并发限制和队列 |

## `v0.1` 项目骨架

### 任务

1. 初始化 Next.js + TypeScript + pnpm 项目。
2. 接入 Tailwind CSS、基础组件、lucide 图标。
3. 建立目录结构：
   - `app/(creator)/page.tsx`
   - `app/settings/page.tsx`
   - `components/creator/*`
   - `components/history/*`
   - `components/ui/*`
   - `lib/validation/*`
4. 实现创作台三栏布局：
   - 左侧参数栏。
   - 中间结果区。
   - 右侧历史/详情。
5. 实现移动端底部参数面板。
6. 实现本地设置页 UI shell：
   - Base URL。
   - 手动 API Key 输入框只允许内存态草稿，不写入 localStorage、sessionStorage 或 IndexedDB。
   - 默认模型。
7. 建立参数 schema：
   - prompt。
   - size。
   - quality。
   - output_format。
   - output_compression。
   - n。
   - background。
   - moderation。

### 验收

- `pnpm dev` 可启动。
- 创作台在桌面和移动端布局不破。
- 表单能校验必填 prompt 和尺寸。
- 高级参数默认折叠。
- 不出现营销首页替代创作台。

## `v0.2` Sub2API 导入与安全边界

### 任务

1. 建立数据库基础模型：
   - User。
   - Session。
   - KeyBinding。
   - AuditLog。
2. 建立 Redis session 或 DB session。
3. 实现：
   - `POST /api/import/exchange`
   - `GET /api/session`
   - `POST /api/session/logout`
4. 实现 key binding 加密保存。
5. 实现手动 key 开发模式，保存和使用都必须走 BFF key binding 加密存储。
6. 实现 session cookie：
   - `HttpOnly`
   - `Secure`
   - `SameSite=Lax`
   - `Path=/`
7. 接入 Sub2API import code 交换契约。
8. 日志脱敏：
   - `Authorization`
   - `api_key`
   - `psypic_session`

### 验收

- 导入接口不返回 `api_key`。
- URL 中不出现 API Key 或长期 bearer token。
- 前端 localStorage 不保存明文 API Key。
- 后端能根据 session 找到 key binding。
- `GET /api/session` 返回模型、limits 和功能开关。

## `v0.3` 文生图 Alpha

### 任务

- [x] 实现 `POST /api/images/generations`。
- [x] BFF 校验参数：
  - `prompt` 必填。
  - `n` 不超过 limits。
  - 禁止 `background=transparent`。
  - MVP 不传 `input_fidelity`。
  - MVP 不启用 `stream`。
- [x] BFF 调 Sub2API：`POST {sub2api_base_url}/v1/images/generations`。
- [x] 实现 TempAsset：
  - 生成结果写入临时资产。
  - 返回 `/api/assets/{asset_id}`。
  - `GET /api/assets/{asset_id}` 校验 session 后返回图片。
- [x] 实现结果卡：
  - 预览。
  - 下载。
  - 复制 prompt。
  - 重试。
- [x] 结果卡支持“作为参考图”，并进入图生图模式。
- [x] 实现 IndexedDB 基础历史：
  - prompt。
  - 参数。
  - 缩略图。
  - 本地 asset 引用。
- [x] 展示 request id、耗时、usage/估算成本。
- [x] 补齐错误提示自动化覆盖：
  - 401。
  - 429。
  - 超时。
  - 上游鉴权、限流、跳转类错误。
  - 前端错误提示带 request id 和 upstream request id。

### 验收

- [x] 导入 session 模式可完成文生图契约测试。
- [x] 生成结果可下载。
- [x] 基础历史可保存并重新读取。
- [x] 上游错误不会泄露 API Key。
- [x] 手动 key 模式接真实 Sub2API 完成浏览器验收。
- [x] BFF 响应链路补齐 request id 和 upstream request id 追踪。

## `v0.4` 图生图与公开试用 MVP

### 任务

- [x] 实现 `POST /api/images/edits`。
- [x] 上传组件支持：
  - 点击选择图片。
  - 拖拽。
  - 粘贴。
- [x] MVP 只支持单参考图。
- [x] 校验上传：
  - MIME。
  - 扩展名。
  - 文件头。
  - 大小。
- [x] 实现结果转参考图。
- [x] 实现继续编辑：
  - 从历史结果进入图生图。
  - [x] 从历史结果进入图生图。
  - [x] 从结果卡进入图生图。
- [x] 实现商业场景入口：
  - 电商主图。
  - 产品换背景。
  - 商品场景图。
  - 广告 Banner。
  - 社媒封面。
  - 人像头像保留为 `v0.8` 商业模板增强项。
- [x] 实现商业尺寸预设：
  - 单次只选择一个目标尺寸。
  - 不做批量多尺寸。
- [x] 补齐 Playwright 或等价 E2E 主流程验收。
- [ ] 回归 MVP 验收清单。

### 验收

- [x] 用户能上传单参考图并生成结果。
- [x] 用户能把上一张结果作为参考图继续编辑。
- [x] 商业尺寸预设能正常约束尺寸。
- [x] 图生图错误提示清楚。
- [ ] MVP 验收清单全部通过。

## `v0.5` 流式和任务系统

### 任务

- [x] 建立服务端图片任务状态模型。
- [x] 同步文生图、图生图接口创建任务并记录成功/失败状态。
- [x] 实现 `GET /api/tasks/{task_id}` 查询当前 session 任务。
- [x] 实现 `POST /api/tasks/{task_id}` 取消 queued/running 任务。
- [x] 创作台展示当前任务状态、task id、耗时和上游 request id。
- [x] 创作台支持从任务状态区取消 running/queued 任务。
- [x] 创作台支持 canceled/failed 任务重新生成。
- [x] 接入 `stream=true` 和 `partial_images`。
- [x] 实现 SSE 转发路由。
- [x] 创作台支持流式 partial preview。
- [x] 引入用户并发限制。
- [ ] 引入任务队列。
- [ ] 补齐流式、取消、并发限制的 E2E 回归。

### 验收

- [x] 生成后可查询并展示服务端任务状态。
- [x] running/queued 任务可从创作台触发取消。
- [x] canceled/failed 任务可在不暴露 Key 的情况下重新提交。
- [x] partial preview 可展示中间图。
- [x] 并发超限返回 429 且错误提示可读。

## 关键文件建议

### 前端

- `app/(creator)/page.tsx`
- `components/creator/PromptPanel.tsx`
- `components/creator/ParameterPanel.tsx`
- `components/creator/ResultGrid.tsx`
- `components/creator/ResultCard.tsx`
- `components/creator/ReferenceUploader.tsx`
- `components/history/LocalHistoryPanel.tsx`
- `components/settings/ApiSettingsForm.tsx`

### API

- `app/api/import/exchange/route.ts`
- `app/api/session/route.ts`
- `app/api/session/logout/route.ts`
- `app/api/images/generations/route.ts`
- `app/api/images/edits/route.ts`
- `app/api/assets/[assetId]/route.ts`
- `app/api/tasks/[taskId]/route.ts`

### 服务

- `server/services/import-service.ts`
- `server/services/session-service.ts`
- `server/services/key-binding-service.ts`
- `server/services/image-service.ts`
- `server/services/image-task-service.ts`
- `server/services/temp-asset-service.ts`
- `server/services/billing-service.ts`

### 校验

- `lib/validation/image-params.ts`
- `lib/validation/upload.ts`
- `lib/validation/import.ts`

## 实施顺序

1. [x] 项目骨架和 UI shell。
2. [x] 参数 schema 和表单。
3. [x] session/key binding。
4. [x] import exchange。
5. [x] Sub2API client。
6. [x] 文生图 API。
7. [x] TempAsset 和下载。
8. [x] 结果网格和本地历史。
9. [x] 图生图上传和 edits API。
10. [x] 继续编辑和商业尺寸预设。
11. [x] 任务状态接口和创作台任务状态区。
12. [x] 流式 partial preview。
13. [x] 用户并发限制。
14. [ ] 任务队列。
15. [ ] MVP/v0.5 验收回归。

## 不允许的捷径

- 前端直接调用 Sub2API。
- API Key 放 URL。
- API Key 放 localStorage。
- 生成接口返回 `api_key`。
- 先做社区信息流再做创作台。
- 把批量多尺寸塞进 MVP。
- 把 mask、多参考图、stream 当作 `v0.4` 必做项。

## 阶段完成定义

每个阶段完成前必须：

- 跑 lint。
- 跑 typecheck。
- 跑已有测试。
- 手工跑主流程。
- 更新 [07-验收清单.md](./07-验收清单.md) 的通过项。
- 记录未完成项和下一阶段任务。
