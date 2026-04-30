# 12. 内部 API 契约

## 通用约定

所有前端请求都调用 PsyPic 自己的 `/api/*`，不得从浏览器直接调用 Sub2API。

鉴权：

- 默认使用 `psypic_session` HttpOnly cookie。
- 前端不读取 session 内容。
- 手动 key 开发模式也必须通过 BFF 转发。

响应格式：

```json
{
  "data": {},
  "request_id": "psypic_req_xxx",
  "upstream_request_id": "req_xxx"
}
```

错误格式：

```json
{
  "error": {
    "code": "invalid_parameter",
    "message": "尺寸不符合 gpt-image-2 规则",
    "details": {
      "field": "size"
    }
  },
  "request_id": "psypic_req_xxx",
  "upstream_request_id": "req_xxx"
}
```

错误码建议：

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `invalid_parameter` | 参数错误 |
| 401 | `unauthorized` | 未登录或 session 失效 |
| 403 | `forbidden` | key 不属于用户、功能未开放、额度限制 |
| 408 | `timeout` | PsyPic 或上游超时 |
| 413 | `payload_too_large` | 上传文件过大 |
| 415 | `unsupported_media_type` | 不支持的图片格式 |
| 429 | `rate_limited` | 并发或频率限制 |
| 502 | `upstream_error` | Sub2API 或上游错误 |
| 503 | `service_unavailable` | 维护或功能关闭 |

日志要求：

- 记录 `request_id`、用户、key binding、任务、耗时、状态码。
- 不记录 API Key、完整 cookie、原始上传图片内容。
- prompt 日志默认可关闭；正式环境要支持脱敏和采样。

## Health

```http
GET /api/health
```

响应：

```json
{
  "data": {
    "ok": true,
    "version": "0.1.0",
    "services": {
      "db": "ok",
      "redis": "ok",
      "storage": "ok"
    }
  }
}
```

## Import Exchange

```http
POST /api/import/exchange
Content-Type: application/json

{
  "import_code": "one_time_import_code"
}
```

行为：

- 消费一次性 `import_code`。
- 向 Sub2API 交换导入配置。
- 创建或更新 key binding。
- 写入 `psypic_session` HttpOnly cookie。
- 响应不返回 `api_key`。

响应：

```json
{
  "data": {
    "session_bound": true,
    "binding_id": "kb_xxx",
    "base_url": "https://sub2api.example.com/v1",
    "default_model": "gpt-image-2",
    "enabled_models": ["gpt-image-2"],
    "limits": {
      "max_n": 4,
      "max_size_tier": "2K",
      "allow_moderation_low": false
    }
  },
  "request_id": "psypic_req_xxx"
}
```

响应头：

```http
Set-Cookie: psypic_session=<opaque_session_id>; HttpOnly; Secure; SameSite=Lax; Path=/
Cache-Control: no-store
```

## Session

```http
GET /api/session
```

响应：

```json
{
  "data": {
    "authenticated": true,
    "user": {
      "id": "user_xxx",
      "display_name": "Sub2API User"
    },
    "binding": {
      "id": "kb_xxx",
      "base_url": "https://sub2api.example.com/v1",
      "default_model": "gpt-image-2",
      "enabled_models": ["gpt-image-2"]
    },
    "limits": {
      "max_n": 4,
      "max_upload_mb": 20,
      "max_size_tier": "2K"
    },
    "features": {
      "community": false,
      "public_publish": false,
      "stream": false
    }
  }
}
```

```http
POST /api/session/logout
```

行为：

- 清除 `psypic_session`。
- 可选吊销当前 session。
- 不删除用户历史和 key binding，除非用户显式解绑。

## Text To Image

```http
POST /api/images/generations
Content-Type: application/json

{
  "prompt": "一张高端电商产品主图...",
  "model": "gpt-image-2",
  "size": "1024x1024",
  "quality": "medium",
  "n": 1,
  "output_format": "png",
  "output_compression": null,
  "background": "auto",
  "moderation": "auto",
  "commercial_preset": "ecommerce_main_image",
  "save_to_history": true
}
```

MVP 规则：

- `prompt` 必填。
- `model` 默认 `gpt-image-2`。
- `n` 默认 1，最大值由 Sub2API limits 决定。
- `background=transparent` 禁止传给 `gpt-image-2`。
- MVP 不传 `input_fidelity`。
- MVP 不启用 `stream`。
- 商业尺寸预设单次只选择一个目标尺寸。

响应：

```json
{
  "data": {
    "task_id": "task_xxx",
    "images": [
      {
        "asset_id": "asset_xxx",
        "url": "/api/assets/asset_xxx",
        "width": 1024,
        "height": 1024,
        "format": "png"
      }
    ],
    "usage": {
      "input_tokens": 0,
      "output_tokens": 0,
      "total_tokens": 0,
      "estimated_cost": "0.0000"
    },
    "duration_ms": 12000
  },
  "request_id": "psypic_req_xxx",
  "upstream_request_id": "req_xxx"
}
```

## Image Edit / Image To Image

```http
POST /api/images/edits
Content-Type: multipart/form-data

prompt=把产品放在高级灰摄影棚背景中
image=<file>
mask=<file optional>
size=1024x1024
quality=medium
n=1
output_format=png
commercial_preset=product_background
```

规则：

- `image` 至少一张。
- `v0.4` 只要求单参考图。
- 多参考图进入 V1。
- `mask` 自 `v0.6` 起可选启用，必须是 PNG；前端遮罩画布导出 alpha PNG 后通过 multipart 的 `mask` 字段提交。
- 文件大小受 `MAX_IMAGE_UPLOAD_MB` 限制。
- 后端校验 MIME、扩展名和实际文件头；mask 尺寸一致性校验后续接入。

响应同 `/api/images/generations`。

## Tasks

`v0.5` 起启用。同步生成接口仍直接返回结果，但服务端会同步创建任务状态，便于后续任务队列、取消、重试和流式 partial preview 复用。

```http
GET /api/tasks/{task_id}
```

响应：

```json
{
  "data": {
    "id": "task_xxx",
    "type": "generation",
    "status": "succeeded",
    "prompt": "一张高端电商产品主图...",
    "params": {
      "size": "1024x1024",
      "quality": "medium",
      "n": 1
    },
    "images": [
      {
        "asset_id": "asset_xxx",
        "url": "/api/assets/asset_xxx",
        "format": "png"
      }
    ],
    "usage": {
      "input_tokens": 0,
      "output_tokens": 0,
      "total_tokens": 0,
      "estimated_cost": "0.0000"
    },
    "upstream_request_id": "req_xxx",
    "duration_ms": 12000,
    "created_at": "2026-05-01T00:00:00.000Z",
    "updated_at": "2026-05-01T00:00:12.000Z"
  },
  "request_id": "psypic_req_xxx"
}
```

```http
POST /api/tasks/{task_id}
```

行为：

- 对 `queued` / `running` 任务标记为 `canceled`。
- 对已完成或失败任务返回当前状态，不删除结果。
- 只能操作当前 session 所属用户的任务。

### 图片任务并发限制

`v0.5` 起，文生图、图生图和流式文生图在通过 session/key binding 与请求参数校验后、创建新任务前，会检查当前用户 active 图片任务数量。

- active 状态：`queued`、`running`。
- 默认限制：每用户 1 个 active 图片任务。
- 环境变量：`PSYPIC_MAX_ACTIVE_IMAGE_TASKS_PER_USER` 可调整限制，非法或未设置时使用默认值。
- 超限响应：HTTP 429，错误码 `rate_limited`。
- 超限时不得调用 Sub2API。

## Streaming Generation

`v0.5` 后启用。

```http
POST /api/images/generations/stream
Accept: text/event-stream
```

事件：

```text
event: task_started
data: {"task_id":"task_xxx","status":"running","request_id":"psypic_req_xxx","upstream_request_id":"req_xxx"}

event: partial_image
data: {"task_id":"task_xxx","index":0,"asset_id":"asset_xxx","url":"/api/assets/asset_xxx","format":"png"}

event: completed
data: {"task_id":"task_xxx","images":[...],"usage":{...},"duration_ms":12000}

event: error
data: {"task_id":"task_xxx","code":"upstream_error","message":"上游失败","request_id":"psypic_req_xxx"}
```

## History

MVP 可先 IndexedDB 保存历史；`v0.7` 后服务端历史可用。

```http
GET /api/history?cursor=xxx&limit=30&type=image_generation
```

响应：

```json
{
  "data": {
    "items": [
      {
        "task_id": "task_xxx",
        "prompt": "一张高端电商产品主图...",
        "thumbnail_url": "/api/assets/asset_xxx",
        "created_at": "2026-04-30T12:00:00Z",
        "favorite": false,
        "tags": ["电商主图"]
      }
    ],
    "next_cursor": "next_xxx"
  }
}
```

```http
POST /api/history/{task_id}/favorite
DELETE /api/history/{task_id}
```

删除规则：

- 软删除任务记录。
- 用户要求物理删除时，异步删除对象存储文件。

## Templates

```http
GET /api/templates?scene=ecommerce&limit=30
```

```json
{
  "data": {
    "items": [
      {
        "id": "tpl_ecommerce_main",
        "name": "电商主图",
        "scene": "ecommerce",
        "fields": [
          {
            "key": "product_type",
            "label": "产品类型",
            "type": "text",
            "required": true
          }
        ],
        "default_params": {
          "size": "1024x1024",
          "quality": "medium",
          "output_format": "png"
        }
      }
    ]
  }
}
```

```http
POST /api/templates/render-prompt
Content-Type: application/json

{
  "template_id": "tpl_ecommerce_main",
  "fields": {
    "product_type": "香水",
    "background_style": "高级灰摄影棚"
  }
}
```

响应：

```json
{
  "data": {
    "prompt": "Create a premium ecommerce hero image..."
  }
}
```

## Community Works

`v0.9` 建立最小作品发布模型，`v1.0` 完整信息流。

```http
POST /api/community/works
Content-Type: application/json

{
  "task_id": "task_xxx",
  "asset_id": "asset_xxx",
  "visibility": "private",
  "title": "高级灰香水主图",
  "scene": "ecommerce",
  "tags": ["电商主图", "香水"],
  "disclose_prompt": false,
  "disclose_params": false,
  "disclose_reference_images": false,
  "allow_same_generation": true,
  "allow_reference_reuse": false
}
```

可见性：

- `private`：仅本人可见。
- `unlisted`：链接可见。
- `public`：公开社区。

发布规则：

- 默认 `private`。
- `public` 必须二次确认。
- prompt、参数、参考图默认不公开。
- `allow_same_generation` 控制是否允许一键同款。
- `allow_reference_reuse` 控制是否允许他人把主图/参考图作为继续编辑素材。
- 管理员可关闭公开发布。

```http
GET /api/community/works?scene=ecommerce&sort=featured&cursor=xxx
GET /api/community/works/{work_id}
POST /api/community/works/{work_id}/same
POST /api/community/works/{work_id}/favorite
DELETE /api/community/works/{work_id}/favorite
POST /api/community/reports
```

同款生成响应：

```json
{
  "data": {
    "draft": {
      "prompt": "Create a premium ecommerce hero image...",
      "params": {
        "size": "1024x1024",
        "quality": "medium"
      },
      "reference_asset_id": "asset_xxx"
    }
  }
}
```

同款生成不应绕过发布者的公开设置：

- 如果 prompt 未公开，只能用模板和公开参数生成近似草稿。
- 如果参考图未公开，不把原图作为可下载资源暴露给其他用户。
- 如果 `allow_same_generation=false`，不展示同款生成入口。
- 如果 `allow_reference_reuse=false`，不返回 `reference_asset_id`。

## Assets

```http
GET /api/assets/{asset_id}
```

规则：

- 检查访问权限。
- `v0.4` 先支持 TempAsset，用于生成结果短期下载。
- 查询顺序：先查 TempAsset；未命中再查正式 ImageAsset。
- `v0.7` 后支持正式 ImageAsset、服务端历史和素材库。
- 私有图只允许本人或有权限的分享链接访问。
- 建议后端返回短期签名 URL 或代理流。

## Admin

```http
GET /api/admin/settings
PATCH /api/admin/settings
GET /api/admin/community/reports
POST /api/admin/community/works/{work_id}/take-down
POST /api/admin/community/works/{work_id}/feature
```

管理员能力：

- 控制最大 `n`。
- 控制最大尺寸。
- 控制是否允许 `moderation=low`。
- 控制社区公开发布。
- 处理举报、下架、精选。
- 查看成本和异常趋势。

## 超时与重试

- 前端生成请求默认超时：5 分钟。
- BFF 调 Sub2API 默认超时：5 分钟。
- 超时任务写入失败状态。
- 用户点击重试必须创建新任务，不覆盖原任务。
- 对上游 429 不做无限重试，提示用户稍后再试。

## 版本兼容

- API 响应字段只新增，不轻易删除。
- 重大变更使用 `/api/v2/*`。
- 社区字段在 `v0.9` 前端可以隐藏，但接口设计从一开始保留扩展空间。
