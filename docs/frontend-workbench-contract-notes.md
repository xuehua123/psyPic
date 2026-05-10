# Frontend Workbench Contract Notes

## 1. 契约总则

- **Response Shape**: 所有接口返回统一的 `jsonOk / jsonError` 格式：
  - 成功: `{ data: T, request_id: string }`
  - 失败: `{ error: { code: string, message: string, details?: any }, request_id?: string }`
- **Fallback / Retry-After**: 当处于离线回退或 `indexeddb` 模式下时，Workbench 相关接口会返回 `503 Service Unavailable`，并带有 `Retry-After` Header，前端应该 fallback 到本地 IndexedDB。
- **Request ID**: 用于追踪与调试，前端在呈现错误时应当尽量暴露 request_id。

## 2. API Contracts

### 2.1 身份与会话 (Auth & Session)
- `POST /api/auth/register`: 注册新用户，创建 DB User。
- `POST /api/auth/login`: 登录。生成 DB Session 并设置 HttpOnly Cookie。
- `POST /api/auth/logout`: 登出并注销 Session。
- `GET /api/session`: 获取当前会话状态。返回当前是否登录，以及是否已经绑定 Sub2API Key。

### 2.2 手动 Key 绑定 (Manual Key)
- `POST /api/settings/manual-key`: 将导入的 Manual API Key 绑定到当前 DB 会话（作为补充 Auth 的凭据，不再作为主要用户身份边界）。

### 2.3 工作台基础数据 (Workbench CRUD)
所有列表查询均支持 `cursor` 和 `limit`，跨用户访问将返回 `403`。

- **Projects (`/api/workbench/projects`)**
  - `GET`: 获取当前用户的项目列表。
  - `POST`: 创建新项目 (入参: `title`, `sortOrder`, `collapsed`, `activeSessionId`)。
  - `GET /:projectId`: 获取单个项目信息。
  - `PATCH /:projectId`: 更新项目信息。
  - `DELETE /:projectId`: 删除项目（级联删除会话和节点，但不删物理历史图片 Task）。

- **Sessions (`/api/workbench/sessions`)**
  - `GET ?project_id=xxx`: 根据项目获取会话列表。
  - `POST`: 创建新会话 (入参包含 `projectId`, `title`, `forkParentVersionNodeId` 等)。
  - `PATCH /:sessionId`: 更新会话信息 (包含 `customLabel`, `isPinned`, `isArchived`, `lastReadAt` 等状态字段)。
  - `DELETE /:sessionId`: 删除会话。

- **Version Nodes (`/api/workbench/version-nodes`)**
  - `GET ?session_id=xxx`: 获取会话下的版本节点。
  - `POST`: 创建版本节点 (带 `promptSnapshot`, `paramsSnapshot`, `status` 等)。
  - `PATCH /:nodeId`: 更新节点状态及输出 (`status`, `outputAssetIds`, `branchLabel` 等)。

### 2.4 同步协议 (Sync Contract)
- `POST /api/workbench/sync`: 客户端拉取增量并推送本地离线修改。
  - **Pull**: 入参 `updatedSince`，返回该时间戳后的服务器改动与被删实体的 Tombstones。
  - **Push**: 入参 `operations` (数组包含 `clientMutationId`, `entity`, `action`, `data`)。
  - **特性**: Last-write-wins 机制。基于 `clientMutationId` 提供幂等性。当客户端修改被更晚的服务器修改拒绝时，返回 conflict payloads 交由客户端解决。

### 2.5 任务运行时事件 (Job Runtime Events)
- `GET /api/workbench/job-runtime-events`
  - 入参: `task_id` 或 `version_node_id`、`cursor`、`limit`。
  - 描述: 返回该任务生命周期中的七种状态事件(`queued`, `running`, `partial_image`, `succeeded`, `failed`, `canceled`, `timed_out`)，用于 Task Dock 和重试历史构建。前端将不再直接读取内存 Task Queue。

### 2.6 图片生成与编辑 (Images API)
- `POST /api/images/generations` 和 `POST /api/images/edits`
  - **扩展参数**: `project_id`, `session_id`, `parent_version_node_id`。
  - 当携带 Workbench 上下文时，后端创建 `ImageTask` 会包含相应的节点，并自动创建/流转 `VersionNode` 的生命周期，完成后自动写回 `outputAssetIds` 并修改状态。
  - 若无上述参数（如在 fallback 模式或未登录），完全保持原有逻辑向后兼容。
