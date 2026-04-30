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
- 本轮已完成：`v0.5` 任务状态查询/取消接口、同步生成任务记录、创作台任务状态展示、取消、重新生成、partial preview、用户并发限制，`v0.6` 遮罩编辑最小闭环，`v0.7` 服务端历史、素材库、收藏/标签、创作台素材库同步、相册、ZIP 下载和图片详情页，以及 `v0.8` 商业模板、Prompt 助手和 Prompt 收藏。
- 已完成 CI：GitHub Actions 执行 lint、typecheck、test、Prisma validate、build。
- 当前主线：`main`。
- 当前焦点：推进 `v0.9` 运营、计费、风控和社区最小发布；`v0.5` 任务队列仍保留为后续异步任务系统收口项。

## 版本拆分

| 版本 | 状态 | 目标 | 交付物 |
| --- | --- | --- | --- |
| `v0.1` | 已完成 | 项目骨架和创作台静态闭环 | UI shell、参数面板、结果区、设置页 |
| `v0.2` | 已完成 | Sub2API 导入和 BFF 安全边界 | session、key binding、import exchange、手动 key |
| `v0.3` | 已完成 | 文生图可用 | `/api/images/generations`、TempAsset、下载、基础历史 |
| `v0.4` | 已完成 | 图生图和公开试用 MVP | `/api/images/edits`、单参考图、继续编辑、MVP 验收 |
| `v0.5` | 进行中 | 流式和任务系统 | 任务状态、取消、重试、SSE partial preview、并发限制和队列 |
| `v0.6` | 已完成 | 遮罩编辑 | 遮罩画布、PNG mask、edits multipart mask、局部编辑模板 |
| `v0.7` | 已完成 | 历史、素材库和相册 | 服务端历史、素材库、收藏、标签、持久化模型、创作台同步入口、相册、ZIP 和详情页已完成并通过 CI |
| `v0.8` | 已完成 | 商业模板和 Prompt 助手 | 模板列表 API、结构化 Prompt 渲染 API、创作台模板字段编辑、Prompt 助手和 Prompt 收藏已完成并通过 CI |
| `v0.9` | 进行中 | 运营、计费、风控和社区最小发布 | 社区作品长期模型、发布 API、作品详情 API、同款生成隐私开关、用量汇总 API、运行时限制和公开发布开关已完成；继续推进管理端、举报和下架 |

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

## `v0.6` 遮罩编辑

### 任务

- [x] 创作台图生图模式支持启用遮罩编辑。
- [x] 提供遮罩画布、涂抹、还原、清空、反选和画笔大小控制。
- [x] 前端导出 PNG mask 并随 `/api/images/edits` 提交。
- [x] BFF 校验 mask MIME、扩展名和文件头。
- [x] 校验 mask 与参考图尺寸一致。
- [x] Sub2API edits multipart 转发 `mask` 字段。
- [x] 补齐局部编辑 prompt 模板。

### 验收

- [x] 开启遮罩后提交图生图会携带 `mask.png`。
- [x] 非 PNG mask 返回 415 且不调用 Sub2API。
- [x] 上游请求中包含 `image` 和 `mask`。
- [x] mask 尺寸不一致时返回可读错误。
- [x] 局部编辑模板会启用遮罩编辑并生成保留未遮罩区域的 prompt。

## `v0.7` 历史、素材库、相册

### 任务

- [x] 实现 `GET /api/history`，从当前用户成功图片任务派生服务端历史。
- [x] 支持 `limit` 和 `cursor` 分页，`next_cursor` 使用当前页最后一条 `task_id`。
- [x] 历史项返回 task、prompt、params、thumbnail、images、usage、upstream request id、耗时和创建时间。
- [x] 未登录返回 401，历史响应不泄露 API Key、session cookie 或 key binding secret。
- [x] 建立素材库记录模型。
- [x] 实现 `GET /api/library` 素材库列表，支持收藏、标签和文本过滤。
- [x] 实现 `PATCH /api/library/{asset_id}` 收藏和标签更新。
- [x] 补齐 Prisma `ImageTask`、`ImageAsset`、`ImageAssetTag`、`Album`、`AlbumItem` 长期模型。
- [x] 创作台右侧面板支持同步服务端素材库、查看标签并切换收藏。
- [x] 实现 `GET /api/library/{asset_id}` 图片资产详情。
- [x] 实现 `POST /api/library/zip` 批量 ZIP 下载。
- [x] 实现 `POST /api/albums` 和 `GET /api/albums` 相册最小模型。
- [x] 实现 `/library/{asset_id}` 图片详情页。
- [x] 详情页支持下载，并通过 `reference_asset` 回到创作台继续编辑。

### 验收

- [x] 当前用户能查询服务端生成历史。
- [x] 分页不会跳过历史记录。
- [x] 未登录不能查询历史。
- [x] 素材库支持收藏、标签和搜索。
- [x] 创作台可显式同步素材库并切换收藏状态。
- [x] 批量 ZIP 下载只包含当前用户可访问图片。
- [x] 相册只允许加入当前用户可访问图片。
- [x] 图片详情页可从素材库进入，并可继续编辑。

## `v0.8` 商业模板和 Prompt 助手

### 任务

- [x] 首批商业模板按 `18-商业模板与Prompt种子库.md` 初始化。
- [x] 实现 `GET /api/templates` 模板列表，支持 scene 过滤、分页和安全序列化。
- [x] 实现 `POST /api/templates/render-prompt` 结构化字段渲染 Prompt。
- [x] 创作台模板中心支持编辑结构化字段后生成 Prompt。
- [x] 实现中文 Prompt 优化、结构化补全和图像编辑保留项生成。
- [x] 实现 Prompt 收藏。

### 验收

- [x] 模板列表不暴露 `promptTemplate` 原文。
- [x] 模板渲染返回 prompt 和默认生成参数。
- [x] 缺少必填字段返回 HTTP 400 和字段级错误。
- [x] 用户可在创作台编辑模板字段并应用到 Prompt。
- [x] Prompt 助手输出不绕过模板约束和安全边界。
- [x] 用户可收藏当前 Prompt，并从右侧面板一键套用。

## `v0.9` 运营、计费、风控和社区最小发布

### 任务

- [x] 成本和 usage 汇总。
- [x] 用户最大 `n`、最大尺寸、最大上传大小集中配置。
- [ ] 管理端页面、持久化开关和日志审计。
- [x] 建立社区作品长期模型：
  - `CommunityWorkVisibility`。
  - `CommunityWorkReviewStatus`。
  - `CommunityWork`。
- [x] 实现 `POST /api/community/works` 最小发布接口。
- [x] 发布时校验当前用户可访问的 `task_id` 和 `asset_id`。
- [x] 默认私有；公开作品必须传入二次确认。
- [x] prompt、参数、参考图默认不公开。
- [x] 实现 `GET /api/community/works/{work_id}` 作品详情接口。
- [x] 实现 `POST /api/community/works/{work_id}/same` 同款生成草稿接口。
- [x] `allow_same_generation=false` 时禁止同款生成。
- [x] 实现 `GET /api/usage` 当前用户图片用量汇总。
- [x] `GET /api/session` 返回运行时功能开关和有效限制。
- [x] 生成接口按运行时 `PSYPIC_MAX_IMAGE_N` 限制最大 `n`。
- [x] 公开发布按 `PSYPIC_PUBLIC_PUBLISH_ENABLED` 开关拦截。
- [ ] 审核开关、举报和下架入口。

### 验收

- [x] 当前用户能把成功生成的素材发布为社区作品。
- [x] 非本人不能发布不可访问的任务或素材。
- [x] public 未二次确认时返回 HTTP 400。
- [x] 未公开 prompt 时详情接口不返回 prompt。
- [x] 关闭同款生成时同款接口返回 HTTP 403。
- [x] 用量汇总只统计当前用户成功任务。
- [x] 运行时最大 `n` 会在调用 Sub2API 前拦截。
- [x] 关闭公开发布时 public 发布返回 HTTP 403。
- [ ] 管理端页面和持久化开关回归通过。

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
- `app/api/history/route.ts`
- `app/api/library/route.ts`
- `app/api/library/[assetId]/route.ts`

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
15. [x] 遮罩编辑最小闭环。
16. [x] mask 尺寸一致性校验。
17. [x] 局部编辑 prompt 模板。
18. [x] 服务端历史、素材库和相册。
    - [x] 服务端历史查询。
    - [x] 素材库、收藏、标签和持久化模型。
    - [x] 相册和 ZIP 下载。
    - [x] 图片详情页。
19. [ ] MVP/v0.5/v0.6 验收回归。
20. [x] v0.8 商业模板和 Prompt 助手。
    - [x] 模板列表 API。
    - [x] 结构化 Prompt 渲染 API。
    - [x] 模板字段编辑。
    - [x] Prompt 优化。
    - [x] Prompt 收藏。
21. [ ] v0.9 运营、计费、风控和社区最小发布。
    - [x] 社区作品 Prisma 模型。
    - [x] 社区作品发布 API。
    - [x] 作品详情 API。
    - [x] 同款生成隐私开关。
    - [x] 成本和 usage 汇总。
    - [x] 运行时限制和公开发布开关。
    - [ ] 管理端限制开关页面和持久化。
    - [ ] 举报和下架入口。

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
