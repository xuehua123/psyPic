# 18. 商业模板与 Prompt 种子库

## 目标

MVP 上线时必须自带商业感，不能只是一个空 prompt 输入框。

本文件提供第一批商业模板：

- 电商主图。
- 产品换背景。
- 商品场景图。
- 广告 Banner。
- 社媒封面。
- 品牌海报。
- 人像头像。
- 应用/网站首屏视觉。

模板是结构化表单，不是固定 prompt。前端收集字段后，由 BFF 或前端模板渲染成 prompt。

## 通用参数

默认参数：

```json
{
  "model": "gpt-image-2",
  "quality": "medium",
  "n": 1,
  "output_format": "png",
  "background": "auto",
  "moderation": "auto"
}
```

MVP 规则：

- 单次只选择一个目标尺寸。
- 不传 `input_fidelity`。
- 不使用 `stream`。
- 禁止 `background=transparent`。
- 图生图必须强调“不改变主体”。

## 工作台上下文

模板应用不是一次性 prompt 拼接，而是一次工作台动作。渲染结果应能写入当前版本节点快照。

建议每次模板应用保存：

- `project_id`
- `session_id`
- `template_id`
- `parent_version_node_id`
- `reference_asset_ids`
- `mask_asset_id`
- `board_document_id`
- `board_snapshot`
- `board_export_asset_id`
- `rendered_prompt`
- `params_snapshot`

## 商业尺寸预设

| 名称 | size | 用途 |
| --- | --- | --- |
| 正方形主图 | `1024x1024` | 电商主图、头像、商品图 |
| 竖版封面 | `1024x1536` | 小红书、海报、竖版广告 |
| 横版 Banner | `1536x1024` | 广告 Banner、公众号封面、网站首屏 |
| 自动 | `auto` | 不确定尺寸时 |

如果 OpenAI/Sub2API 实际支持尺寸集不同，以 [02-接口参数方案.md](./02-接口参数方案.md) 和后端校验为准。

## Prompt 输出结构

推荐结构：

```text
Create a high-quality commercial image.

Scene:
Subject:
Background:
Lighting:
Composition:
Style:
Text:
Constraints:
Output:
```

中文用户输入可先结构化，再翻译或保留中英混合。不要直接把用户零散输入拼成一句长 prompt。

## 模板 1：电商主图

### 字段

| key | label | type | required | default |
| --- | --- | --- | --- | --- |
| `product_type` | 产品类型 | text | yes |  |
| `selling_point` | 核心卖点 | text | no | 高级、干净、有质感 |
| `background_style` | 背景风格 | select | yes | 高级灰摄影棚 |
| `lighting` | 光线 | select | no | 柔和侧光 |
| `composition` | 构图 | select | no | 居中构图 |
| `leave_space` | 是否留白 | boolean | no | true |
| `text_policy` | 文字策略 | select | no | 不添加文字 |

### 默认参数

```json
{
  "size": "1024x1024",
  "quality": "medium",
  "output_format": "png"
}
```

### Prompt 模板

```text
Create a premium ecommerce main product image.

Scene: A clean commercial studio setup for {product_type}.
Subject: The product is the clear hero subject, sharp, realistic, premium, with visible details.
Background: {background_style}, minimal, uncluttered, suitable for ecommerce.
Lighting: {lighting}, soft shadows, controlled highlights.
Composition: {composition}, product occupies the visual center, balanced negative space.
Text: {text_policy}.
Constraints: Do not change the product shape, logo, label, material, color, or proportions. Do not add extra objects unless requested. Avoid distorted text, watermarks, low quality, clutter.
Output: High-end commercial product photography, ready for marketplace listing.
```

### 示例输入

```json
{
  "product_type": "透明玻璃香水瓶",
  "selling_point": "高级、清透、适合礼物",
  "background_style": "高级灰摄影棚",
  "lighting": "柔和侧光",
  "composition": "居中构图",
  "leave_space": true,
  "text_policy": "不添加文字"
}
```

## 模板 2：产品换背景

### 字段

| key | label | type | required | default |
| --- | --- | --- | --- | --- |
| `product_type` | 产品类型 | text | yes |  |
| `new_background` | 新背景 | text | yes | 高级灰商业摄影棚 |
| `surface` | 承托表面 | select | no | 轻微反光台面 |
| `shadow` | 阴影 | select | no | 自然柔和阴影 |
| `preserve_policy` | 保留要求 | text | no | 保持产品主体完全一致 |

### 默认参数

```json
{
  "size": "1024x1024",
  "quality": "medium",
  "output_format": "png"
}
```

### Prompt 模板

```text
Edit the image into a commercial product background replacement.

Subject: Keep the original {product_type} exactly the same.
Background: Replace the background with {new_background}.
Surface: Place the product on {surface}.
Lighting: Match the product with realistic studio lighting and {shadow}.
Constraints: {preserve_policy}. Do not change the product shape, logo, label, texture, color, or proportions. Do not add text. Keep edges clean and realistic.
Output: Professional ecommerce product image with a clean commercial background.
```

## 模板 3：商品场景图

### 字段

| key | label | type | required | default |
| --- | --- | --- | --- | --- |
| `product_type` | 产品类型 | text | yes |  |
| `usage_scene` | 使用场景 | text | yes | 高端居家桌面 |
| `mood` | 氛围 | select | no | 温暖高级 |
| `props` | 道具 | text | no | 少量相关道具 |
| `audience` | 目标人群 | text | no | 年轻城市消费者 |

### 默认参数

```json
{
  "size": "1536x1024",
  "quality": "medium",
  "output_format": "png"
}
```

### Prompt 模板

```text
Create a lifestyle commercial scene image for {product_type}.

Scene: {usage_scene}, designed for {audience}.
Subject: The product remains the main focus, realistic and premium.
Mood: {mood}, aspirational but believable.
Props: {props}, minimal and relevant, not distracting.
Lighting: Natural commercial lighting with depth and soft shadows.
Composition: Product clearly visible, enough negative space for marketing use.
Text: No text.
Constraints: Keep the product accurate. Avoid clutter, distorted objects, watermarks, unrealistic scale, extra logos.
Output: High-quality commercial lifestyle image.
```

## 模板 4：广告 Banner

### 字段

| key | label | type | required | default |
| --- | --- | --- | --- | --- |
| `campaign_theme` | 活动主题 | text | yes | 新品上市 |
| `product_type` | 产品类型 | text | yes |  |
| `visual_style` | 视觉风格 | select | no | 高端极简 |
| `space_for_text` | 文案留白位置 | select | no | 右侧留白 |
| `platform` | 平台 | select | no | 网站横幅 |

### 默认参数

```json
{
  "size": "1536x1024",
  "quality": "medium",
  "output_format": "png"
}
```

### Prompt 模板

```text
Create a commercial advertising banner visual.

Campaign: {campaign_theme}.
Product: {product_type}.
Style: {visual_style}, polished, modern, premium.
Layout: Designed for {platform}, with clear {space_for_text} for marketing copy.
Lighting: Professional advertising lighting, strong visual hierarchy.
Text: Do not render text unless explicitly provided.
Constraints: Keep the product accurate. Avoid random letters, fake logos, watermarks, clutter, and distorted product details.
Output: A refined banner background ready for adding copy in design software.
```

## 模板 5：社媒封面

### 字段

| key | label | type | required | default |
| --- | --- | --- | --- | --- |
| `platform` | 平台 | select | yes | 小红书 |
| `topic` | 主题 | text | yes |  |
| `style` | 风格 | select | no | 清爽高级 |
| `subject` | 主体 | text | no | 产品或人物 |
| `text_space` | 标题区域 | select | no | 顶部留白 |

### 默认参数

```json
{
  "size": "1024x1536",
  "quality": "medium",
  "output_format": "png"
}
```

### Prompt 模板

```text
Create a social media cover image for {platform}.

Topic: {topic}.
Subject: {subject}.
Style: {style}, visually attractive, clean and high-quality.
Composition: Vertical cover layout with {text_space} reserved for title text.
Lighting: Bright and polished, suitable for mobile feed.
Text: Do not generate text. Leave clean space for text overlay.
Constraints: Avoid clutter, fake typography, watermarks, low-resolution details.
Output: Eye-catching cover image ready for social media publishing.
```

## 模板 6：品牌海报

### 字段

| key | label | type | required | default |
| --- | --- | --- | --- | --- |
| `brand_mood` | 品牌调性 | text | yes | 高端、可信、现代 |
| `main_subject` | 主体 | text | yes |  |
| `brand_color` | 品牌色 | color | no |  |
| `poster_scene` | 海报场景 | text | no | 极简商业视觉 |
| `text_policy` | 文字策略 | select | no | 留白不加字 |

### 默认参数

```json
{
  "size": "1024x1536",
  "quality": "medium",
  "output_format": "png"
}
```

### Prompt 模板

```text
Create a premium brand poster visual.

Brand mood: {brand_mood}.
Subject: {main_subject}.
Color direction: Use {brand_color} as an accent if provided, keep the overall palette professional.
Scene: {poster_scene}.
Composition: Strong visual hierarchy, clean layout, suitable for poster design.
Text: {text_policy}.
Constraints: Do not create unreadable text, random logos, watermarks, or clutter. Keep the image polished and commercially usable.
Output: High-end brand poster background ready for final copywriting.
```

## 模板 7：人像头像

### 字段

| key | label | type | required | default |
| --- | --- | --- | --- | --- |
| `portrait_type` | 头像类型 | select | yes | 商务头像 |
| `background` | 背景 | select | no | 干净中性背景 |
| `lighting` | 光线 | select | no | 柔和正面光 |
| `style` | 风格 | select | no | 真实专业摄影 |
| `identity_policy` | 身份保持 | text | no | 保持人物身份和五官一致 |

### 默认参数

```json
{
  "size": "1024x1024",
  "quality": "medium",
  "output_format": "png"
}
```

### Prompt 模板

```text
Create a professional portrait image.

Portrait type: {portrait_type}.
Background: {background}.
Lighting: {lighting}.
Style: {style}, polished but natural.
Constraints: {identity_policy}. Do not change facial identity, age, ethnicity, or key personal features. Avoid plastic skin, distorted eyes, extra fingers, watermarks, or fake text.
Output: Clean professional profile portrait suitable for business use.
```

## 模板 8：应用/网站首屏视觉

### 字段

| key | label | type | required | default |
| --- | --- | --- | --- | --- |
| `product_name` | 产品/网站名称 | text | no |  |
| `industry` | 行业 | text | yes | AI 工具 |
| `visual_metaphor` | 视觉隐喻 | text | no | 高效创作工作台 |
| `style` | 风格 | select | no | 现代科技商业 |
| `layout` | 构图 | select | no | 横版首屏背景 |

### 默认参数

```json
{
  "size": "1536x1024",
  "quality": "medium",
  "output_format": "png"
}
```

### Prompt 模板

```text
Create a hero visual for a commercial website or app.

Industry: {industry}.
Product: {product_name}.
Visual metaphor: {visual_metaphor}.
Style: {style}, premium, clear, modern, not cluttered.
Layout: {layout}, with clean negative space for headline and CTA.
Text: Do not render text.
Constraints: Avoid fake UI text, random icons, unreadable typography, watermarks, and overly abstract gradients.
Output: High-quality hero background suitable for a landing page or SaaS website.
```

## 种子数据格式

建议以 JSON 或 TypeScript 常量保存：

```ts
export const commercialTemplates = [
  {
    id: "tpl_ecommerce_main",
    name: "电商主图",
    scene: "ecommerce",
    requiresImage: false,
    workbenchContext: {
      createsVersionNode: true,
      supportsForkFromNode: true,
      supportsReferenceAssets: false
    },
    defaultParams: {
      size: "1024x1024",
      quality: "medium",
      output_format: "png"
    },
    fields: [],
    promptTemplate: "Create a premium ecommerce main product image..."
  }
]
```

## MVP 推荐首批启用

`v0.4` 公开试用前至少启用：

- 电商主图。
- 产品换背景。
- 商品场景图。
- 广告 Banner。
- 社媒封面。

其余模板可在 `v0.8` 商业模板阶段完善。

## 模板渲染规则

MVP 只做模板字段渲染，不做 Prompt 助手。这里的规则只用于把结构化表单拼成 prompt：

- 按模板字段填充 `promptTemplate`。
- 使用模板默认的场景、主体、光线、构图和约束。
- 图生图模板固定加入“不改变主体”的约束。
- Banner/封面模板固定加入“不生成文字，保留留白”的约束。
- 只移除空字段和明显冲突字段，不自动扩写用户输入。
- 渲染结果写入 `params_snapshot` 和 `prompt_snapshot`，便于恢复参数、从此分叉和同款生成。

不要自动加入：

- 随机品牌名。
- 随机文字。
- 未经用户提供的 logo。
- 夸张虚假宣传。
- 可能侵权的人名、IP、商标。

真正的中文优化、结构化补全、Prompt 收藏、图像编辑保留项生成属于 `v0.8` Prompt 助手范围。

## 质量检查

模板生成的 prompt 应满足：

- 读起来像商业摄影/设计 brief。
- 有明确主体、场景、光线、构图、约束。
- 对图生图场景明确“不改变主体”。
- 对封面/Banner 明确“不生成文字，保留留白”。
- 不把尺寸、格式、quality 写进 prompt 正文，参数由 API 控制。
