# 04. Sub2API 集成方案

## 集成目标

PsyPic 必须支持用户从 Sub2API 一键导入可用密钥，并直接进入创作台。

目标：

- 用户不需要手动复制 API Key。
- API Key 不出现在 URL。
- API Key 不进入前端长期明文存储。
- 管理员可以控制是否开放 PsyPic。
- Sub2API 仍然负责额度、分组、费率、计费和风控。

## 推荐方案：短期 ticket + 后端代持

### 流程

```text
1. 用户在 Sub2API Keys 页面点击“打开 PsyPic”
2. Sub2API 创建一次性 launch_ticket
3. 浏览器打开 PsyPic import/bridge URL
4. PsyPic 后端用 ticket 向 Sub2API 交换导入配置
5. Sub2API 校验用户、key、状态、额度、分组
6. PsyPic 创建 session，后端代持密钥或绑定 key id
7. 前端进入创作台
```

### 安全要求

- ticket TTL 建议 60 秒。
- ticket 一次性消费。
- ticket 绑定 `user_id` 和 `api_key_id`。
- ticket 不能换取不属于该用户的 key。
- key 必须 active。
- key 不应过期、额度不应耗尽。
- 推荐要求 key 所属 group platform 为 OpenAI。
- exchange 接口必须 `no-store`。

## Sub2API 侧新增能力

建议新增通用外部应用集成，而不是只复制 LobeHub 命名。

### 管理配置

新增设置项：

- `psypic_enabled`
- `psypic_app_url`
- `hide_psypic_import_button`
- `psypic_default_model`
- `psypic_enabled_models`
- `psypic_max_n`
- `psypic_max_size_tier`
- `psypic_allow_moderation_low`

### 用户 API

```http
POST /api/v1/psypic/launch-ticket
Authorization: Bearer <sub2api user jwt>
Content-Type: application/json

{
  "api_key_id": 123
}
```

响应：

```json
{
  "ticket_id": "one_time_ticket",
  "bridge_url": "/api/v1/psypic/bridge?ticket=one_time_ticket"
}
```

### Bridge

```http
GET /api/v1/psypic/bridge?ticket=...
```

行为：

- 消费 ticket。
- 校验 key。
- 生成 PsyPic 可交换的短期导入凭证。
- 同域或同父域部署时，优先通过 `HttpOnly + Secure + SameSite` cookie 传递导入凭证。
- 跨域部署时，跳转到 PsyPic 时只携带一次性 `import_code`，该 code 不包含 API Key，TTL 建议 30 秒，且只能 POST 交换一次。

```text
https://psypic.example.com/import?code=<one_time_import_code>
```

禁止把 API Key、可长期调用的 bearer token、或可重复使用的 target token 放进 URL。

### PsyPic BFF Exchange

Sub2API 侧只负责 `/api/v1/psypic/launch-ticket` 和 `/api/v1/psypic/bridge`。浏览器跳转到 PsyPic 后，由 PsyPic 自己的 BFF 统一消费 `import_code`：

```http
POST https://psypic.example.com/api/import/exchange
Content-Type: application/json

{
  "import_code": "one_time_import_code"
}
```

行为：

- PsyPic BFF 消费 `import_code`，前端不直接拿 `import_code` 调 Sub2API。
- PsyPic BFF 从 Sub2API 换取导入绑定后，保存加密的 Sub2API API Key，或保存可由后端解析的 `api_key_id` 绑定。
- PsyPic BFF 创建 PsyPic session，并通过 `HttpOnly + Secure + SameSite=Lax` cookie 返回给浏览器。
- 响应体只返回创作台需要展示和校验的非敏感配置，不返回 `api_key`；`binding_id` 只能用于展示或诊断，不能作为认证凭证。

响应头：

```http
Set-Cookie: psypic_session=<opaque_session_id>; HttpOnly; Secure; SameSite=Lax; Path=/
Cache-Control: no-store
```

响应体：

```json
{
  "session_bound": true,
  "binding_id": "psypic_key_binding_id",
  "base_url": "https://sub2api.example.com/v1",
  "default_model": "gpt-image-2",
  "enabled_models": ["gpt-image-2"],
  "limits": {
    "max_n": 4,
    "max_size_tier": "2K",
    "allow_moderation_low": false
  }
}
```

后续前端只调用 PsyPic 自己的 `/api/images/*` 接口，并随请求自动携带 `psypic_session` cookie；PsyPic BFF 根据 session 查找后端保存的绑定，再带 Sub2API key 调网关。

## PsyPic 调用 Sub2API

PsyPic 后端调用：

```http
POST {sub2api_base_url}/v1/images/generations
Authorization: Bearer <sub2api_api_key>
Content-Type: application/json
```

或：

```http
POST {sub2api_base_url}/v1/images/edits
Authorization: Bearer <sub2api_api_key>
Content-Type: multipart/form-data
```

Sub2API 当前已支持：

- `/v1/images/generations`
- `/v1/images/edits`
- `gpt-image-2` 默认模型
- `partial_images`
- `output_compression`
- `moderation`
- 删除 `gpt-image-2` 不支持的 `input_fidelity` 和透明背景

## Provider 边界

当前默认上游仍是 Sub2API，但工作台文档不应把所有能力写死到这一层。

建议按能力拆成几类 provider：

- generation provider：Sub2API / OpenAI Images API / Responses API image tool。
- image utility provider：背景移除、超分、压缩、OCR、审核等未来工具。
- storage provider：local / S3 / R2 / MinIO。
- queue provider：in-memory / Redis / DB-backed worker。

PsyPic BFF 只依赖统一的 provider interface，再由配置决定走哪条实现。这样工作台、历史、版本图和任务 runtime 都能保持同一套数据语义，而不会被某个具体网关绑死。

Board Mode 也遵守这个边界：拼图画布只在 PsyPic 内部导出 reference PNG / mask PNG，上游仍只接收标准 Images API 的 `image` 和 `mask`。Sub2API 不需要理解 BoardDocument、BoardLayer 或 Konva 状态。

## 计费调整

当前 Sub2API 图片计费按图片档位近似：

- `1K`
- `2K`
- `4K`
- 每图价格

`gpt-image-2` 官方成本更接近：

- 文本输入 token
- 图片输入 token
- 图片输出 token
- `quality`
- `size`
- `partial_images`

建议阶段：

### MVP

- 使用现有 Sub2API 图片计费。
- PsyPic 只展示估算成本，标注“以实际扣费为准”。

### V1

- Sub2API usage log 保存 image input/output token。
- 根据 OpenAI 返回 `usage` 精算。
- 将 `quality`、`size`、`partial_images` 纳入成本估算。

### 封板

- 支持管理员配置图片模型倍率。
- 支持按用户/group 限制 4K、高质量、批量。
- usage、扣费、任务记录可以互相追溯。

## 失败处理

常见错误：

- ticket 过期：提示重新从 Sub2API 打开。
- key 不属于用户：拒绝导入。
- key inactive：提示先启用 key。
- key quota exhausted：提示额度耗尽。
- group 不是 OpenAI：提示该 key 不支持 Images API。
- upstream 429：提示排队或稍后重试。
- upstream 400：展示参数错误和建议修正。
