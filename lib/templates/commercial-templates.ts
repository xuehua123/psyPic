import {
  imageGenerationDefaults,
  type ImageGenerationParams
} from "@/lib/validation/image-params";

/**
 * 商业模板字段类型系统（plan slug quiet-glittering-prism · Cut 3）：
 *
 * 4 → 7 类字段 + `constant`：
 * - text          单行文本
 * - select        单选下拉
 * - segmented     分段控制器（语义"几选一"，4 项以内推荐 segmented 替代 select）
 * - multi-select  多选 chip（输出 string[]）
 * - slider        数值滑块（range 配 min/max/step；输出 number）
 * - boolean       checkbox（输出 boolean）
 * - color         颜色选择
 * - constant      写死字段，UI **不渲染**，渲染层直接用 field.constantValue
 *
 * 字段加 `placement: "primary" | "advanced"`：
 * - primary：默认显示在模板字段区主区
 * - advanced：折叠到「细节」抽屉 / 折叠区
 * - 缺省 = "primary"
 */
type TemplateFieldType =
  | "text"
  | "select"
  | "segmented"
  | "multi-select"
  | "slider"
  | "boolean"
  | "color"
  | "constant";

export type TemplateFieldPlacement = "primary" | "advanced";

export type CommercialTemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  /** 默认值，类型按 type 不同：text/select/segmented/color → string；
   *  boolean → boolean；multi-select → string[]；slider → number；
   *  constant 用 constantValue（这里不传）。 */
  defaultValue?: string | boolean | string[] | number;
  /** select / segmented / multi-select 选项 */
  options?: string[];
  /** slider 范围 */
  range?: { min: number; max: number; step: number };
  /** placement 缺省 = primary */
  placement?: TemplateFieldPlacement;
  /** constant 类型时的固定值（渲染层用），不显示 UI */
  constantValue?: string;
  /** 字段说明文案（在 UI 上小字 hint 形式显示，optional） */
  hint?: string;
};

export type CommercialTemplateCategory =
  | "ecommerce"
  | "marketing"
  | "content"
  | "portrait_brand";

export const TEMPLATE_CATEGORY_LABEL: Record<
  CommercialTemplateCategory,
  string
> = {
  ecommerce: "电商商品",
  marketing: "营销广告",
  content: "内容封面",
  portrait_brand: "人像 / 品牌"
};

export type CommercialTemplate = {
  id: string;
  name: string;
  scene: string;
  description: string;
  /** 4 大场景类别（plan slug quiet-glittering-prism · Cut 3）。 */
  category: CommercialTemplateCategory;
  requiresImage: boolean;
  requiresMask?: boolean;
  enabledForMvp: boolean;
  defaultParams: {
    size: "1024x1024" | "1536x1024" | "1024x1536";
    quality: "medium";
    output_format: "png";
  };
  fields: CommercialTemplateField[];
  promptTemplate: string;
};

export type RenderedCommercialPrompt = {
  prompt: string;
  params: Omit<
    ImageGenerationParams,
    "prompt" | "size" | "quality" | "output_format"
  > &
    CommercialTemplate["defaultParams"];
};

const commonParams = {
  quality: "medium",
  output_format: "png"
} as const;

/**
 * 通用 constant 字段（多个模板共享）。每个模板可在 fields 数组里直接 inline
 * 一份这些约束，渲染时用 {key} 占位符引用 constantValue。
 */
const CONST_NO_TEXT: CommercialTemplateField = {
  key: "_no_text",
  label: "(写死) 不生成文字",
  type: "constant",
  required: false,
  constantValue: "Do not render any text or watermark in the image",
  placement: "advanced"
};

const CONST_PRESERVE_PRODUCT: CommercialTemplateField = {
  key: "_preserve_product",
  label: "(写死) 保留主体一致",
  type: "constant",
  required: false,
  constantValue:
    "Do not change the product shape, logo, label, material, color, or proportions",
  placement: "advanced"
};

export const commercialTemplates: CommercialTemplate[] = [
  // ============ 电商商品 (5) ============
  {
    id: "tpl_ecommerce_main",
    name: "电商主图",
    scene: "ecommerce",
    description: "干净棚拍、主体居中、适合商品列表",
    category: "ecommerce",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1024x1024",
      ...commonParams
    },
    fields: [
      {
        key: "product_type",
        label: "产品类型",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "selling_point",
        label: "核心卖点",
        type: "text",
        required: false,
        defaultValue: "高级、干净、有质感",
        placement: "primary"
      },
      {
        key: "background_style",
        label: "背景",
        type: "segmented",
        required: true,
        defaultValue: "高级灰摄影棚",
        options: ["高级灰摄影棚", "纯白电商", "浅色渐变", "桌面场景"],
        placement: "primary"
      },
      {
        key: "lighting",
        label: "光线",
        type: "select",
        required: false,
        defaultValue: "柔和侧光",
        options: ["柔和侧光", "顶部柔光", "高反差商业光", "自然窗光"],
        placement: "advanced"
      },
      {
        key: "composition",
        label: "构图",
        type: "segmented",
        required: false,
        defaultValue: "居中",
        options: ["居中", "三分法", "低机位近景", "留白"],
        placement: "advanced"
      },
      {
        key: "modifiers",
        label: "效果增强",
        type: "multi-select",
        required: false,
        defaultValue: ["质感细腻"],
        options: ["质感细腻", "色彩鲜明", "对比强烈", "胶片颗粒"],
        placement: "advanced",
        hint: "多选叠加，影响 prompt 末尾风格化关键词"
      },
      {
        key: "leave_space",
        label: "保留留白",
        type: "boolean",
        required: false,
        defaultValue: true,
        placement: "advanced"
      },
      CONST_NO_TEXT,
      CONST_PRESERVE_PRODUCT
    ],
    promptTemplate: `Create a premium ecommerce main product image.

Scene: A clean commercial studio setup for {product_type}.
Subject: The product is the clear hero subject, sharp, realistic, premium, with visible details ({selling_point}).
Background: {background_style}, minimal, uncluttered, suitable for ecommerce.
Lighting: {lighting}, soft shadows, controlled highlights.
Composition: {composition}, balanced negative space.
Effects: {modifiers}.
Constraints: {_preserve_product}. {_no_text}.
Output: High-end commercial product photography, ready for marketplace listing.`
  },
  {
    id: "tpl_product_background",
    name: "产品换背景",
    scene: "background_replacement",
    description: "保留主体，替换为商业摄影背景",
    category: "ecommerce",
    requiresImage: true,
    enabledForMvp: true,
    defaultParams: {
      size: "1024x1024",
      ...commonParams
    },
    fields: [
      {
        key: "product_type",
        label: "产品类型",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "new_background",
        label: "新背景",
        type: "text",
        required: true,
        defaultValue: "高级灰商业摄影棚",
        placement: "primary"
      },
      {
        key: "surface",
        label: "承托表面",
        type: "select",
        required: false,
        defaultValue: "轻微反光台面",
        options: ["轻微反光台面", "哑光石材台面", "木质台面", "纯色背景无台面"],
        placement: "primary"
      },
      {
        key: "shadow_intensity",
        label: "阴影强度",
        type: "slider",
        required: false,
        defaultValue: 3,
        range: { min: 1, max: 5, step: 1 },
        placement: "advanced",
        hint: "1=极弱投影 / 3=标准 / 5=强阴影"
      },
      {
        key: "preserve_strict",
        label: "严格保留主体",
        type: "boolean",
        required: false,
        defaultValue: true,
        placement: "advanced"
      },
      CONST_PRESERVE_PRODUCT,
      CONST_NO_TEXT
    ],
    promptTemplate: `Edit the image into a commercial product background replacement.

Subject: Keep the original {product_type} exactly the same.
Background: Replace the background with {new_background}.
Surface: Place the product on {surface}.
Lighting: Match the product with realistic studio lighting and shadow intensity {shadow_intensity}/5.
Constraints: {_preserve_product}. {_no_text}. Keep edges clean and realistic.
Output: Professional ecommerce product image with a clean commercial background.`
  },
  {
    id: "tpl_lifestyle_scene",
    name: "商品场景图",
    scene: "lifestyle",
    description: "把商品放入可信的生活或使用场景",
    category: "ecommerce",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1536x1024",
      ...commonParams
    },
    fields: [
      {
        key: "product_type",
        label: "产品类型",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "usage_scene",
        label: "使用场景",
        type: "text",
        required: true,
        defaultValue: "高端居家桌面",
        placement: "primary"
      },
      {
        key: "mood",
        label: "氛围",
        type: "segmented",
        required: false,
        defaultValue: "温暖高级",
        options: ["温暖高级", "清爽自然", "现代科技", "奢华精致"],
        placement: "primary"
      },
      {
        key: "props",
        label: "道具",
        type: "text",
        required: false,
        defaultValue: "少量相关道具",
        placement: "advanced"
      },
      {
        key: "audience",
        label: "目标人群",
        type: "text",
        required: false,
        defaultValue: "年轻城市消费者",
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a lifestyle commercial scene image for {product_type}.

Scene: {usage_scene}, designed for {audience}.
Subject: The product remains the main focus, realistic and premium.
Mood: {mood}, aspirational but believable.
Props: {props}, minimal and relevant, not distracting.
Lighting: Natural commercial lighting with depth and soft shadows.
Composition: Product clearly visible, enough negative space for marketing use.
Constraints: {_no_text}. Avoid clutter, distorted objects, watermarks, unrealistic scale, extra logos.
Output: High-quality commercial lifestyle image.`
  },
  {
    id: "tpl_product_compare",
    name: "商品对比图",
    scene: "product_compare",
    description: "改前/改后、左右双栏、突出对比",
    category: "ecommerce",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1536x1024",
      ...commonParams
    },
    fields: [
      {
        key: "product_type",
        label: "产品类型",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "layout",
        label: "对比布局",
        type: "segmented",
        required: true,
        defaultValue: "左右双栏",
        options: ["左右双栏", "改前改后", "上下对比"],
        placement: "primary"
      },
      {
        key: "emphasis",
        label: "强调点",
        type: "segmented",
        required: false,
        defaultValue: "突出改进",
        options: ["突出改进", "突出对比", "突出主体"],
        placement: "primary"
      },
      {
        key: "background_style",
        label: "背景",
        type: "select",
        required: false,
        defaultValue: "纯净背景",
        options: ["纯净背景", "高级灰", "渐变背景"],
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a commercial product comparison visual for {product_type}.

Layout: {layout} composition, two visually balanced areas for clear comparison.
Emphasis: {emphasis}, with strong visual hierarchy that the viewer reads at a glance.
Background: {background_style}, minimal and consistent across both halves.
Lighting: Studio quality, identical light treatment on both sides for fair comparison.
Constraints: {_no_text}. No labels, arrows or annotations — keep the image purely visual so designers can overlay text later.
Output: High-end commercial comparison image suitable for marketplace listings or marketing pages.`
  },
  {
    id: "tpl_product_detail",
    name: "商品细节特写",
    scene: "product_detail",
    description: "微距 / 局部、突出材质和细节",
    category: "ecommerce",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1024x1024",
      ...commonParams
    },
    fields: [
      {
        key: "product_type",
        label: "产品类型",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "detail_focus",
        label: "细节焦点",
        type: "text",
        required: true,
        defaultValue: "表面材质和质感",
        placement: "primary",
        hint: "如：表带 / 缝线 / 纹理 / 光泽 / 雕花"
      },
      {
        key: "magnification",
        label: "放大程度",
        type: "segmented",
        required: false,
        defaultValue: "近景",
        options: ["微距", "特写", "近景", "中景"],
        placement: "primary"
      },
      {
        key: "lighting",
        label: "光线",
        type: "select",
        required: false,
        defaultValue: "侧光突出质感",
        options: ["侧光突出质感", "顶光柔和", "环形商业光", "戏剧高对比"],
        placement: "advanced"
      },
      CONST_PRESERVE_PRODUCT,
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a commercial product detail close-up for {product_type}.

Focus: {detail_focus} — render with precise material accuracy.
Magnification: {magnification} framing, with shallow depth of field where appropriate.
Lighting: {lighting}, sculpting the texture and surface qualities clearly.
Constraints: {_preserve_product}. {_no_text}.
Output: Premium product detail photography that highlights material and craftsmanship.`
  },

  // ============ 营销广告 (4) ============
  {
    id: "tpl_ad_banner",
    name: "广告 Banner",
    scene: "ad_banner",
    description: "横版广告视觉，预留文案空间",
    category: "marketing",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1536x1024",
      ...commonParams
    },
    fields: [
      {
        key: "campaign_theme",
        label: "活动主题",
        type: "text",
        required: true,
        defaultValue: "新品上市",
        placement: "primary"
      },
      {
        key: "product_type",
        label: "产品类型",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "visual_style",
        label: "视觉风格",
        type: "segmented",
        required: false,
        defaultValue: "高端极简",
        options: ["高端极简", "明亮促销", "科技未来", "奢华质感"],
        placement: "primary"
      },
      {
        key: "space_for_text",
        label: "文案位置",
        type: "segmented",
        required: false,
        defaultValue: "右侧留白",
        options: ["右侧留白", "左侧留白", "顶部留白", "中间留白"],
        placement: "primary"
      },
      {
        key: "platform",
        label: "投放平台",
        type: "select",
        required: false,
        defaultValue: "网站横幅",
        options: ["网站横幅", "电商店铺 Banner", "公众号封面", "信息流广告"],
        placement: "advanced"
      },
      {
        key: "mood_modifiers",
        label: "氛围增强",
        type: "multi-select",
        required: false,
        defaultValue: [],
        options: ["明亮", "深邃", "活力", "静谧", "未来感"],
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a commercial advertising banner visual.

Campaign: {campaign_theme}.
Product: {product_type}.
Style: {visual_style}, polished, modern, premium.
Mood: {mood_modifiers}.
Layout: Designed for {platform}, with clear {space_for_text} for marketing copy.
Lighting: Professional advertising lighting, strong visual hierarchy.
Constraints: {_no_text}. Avoid random letters, fake logos, watermarks, clutter, and distorted product details.
Output: A refined banner background ready for adding copy in design software.`
  },
  {
    id: "tpl_app_hero",
    name: "应用 / 网站首屏",
    scene: "app_hero",
    description: "网站或应用首屏商业视觉",
    category: "marketing",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1536x1024",
      ...commonParams
    },
    fields: [
      {
        key: "product_name",
        label: "产品 / 网站名",
        type: "text",
        required: false,
        placement: "primary"
      },
      {
        key: "industry",
        label: "行业",
        type: "text",
        required: true,
        defaultValue: "AI 工具",
        placement: "primary"
      },
      {
        key: "visual_metaphor",
        label: "视觉隐喻",
        type: "text",
        required: false,
        defaultValue: "高效创作工作台",
        placement: "primary"
      },
      {
        key: "style",
        label: "风格",
        type: "segmented",
        required: false,
        defaultValue: "现代科技",
        options: ["现代科技", "清爽 SaaS", "高级极简", "创意工作台"],
        placement: "primary"
      },
      {
        key: "layout",
        label: "构图",
        type: "select",
        required: false,
        defaultValue: "横版首屏",
        options: ["横版首屏", "左侧留白", "右侧留白", "中心透视"],
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a hero visual for a commercial website or app.

Industry: {industry}.
Product: {product_name}.
Visual metaphor: {visual_metaphor}.
Style: {style}, premium, clear, modern, not cluttered.
Layout: {layout}, with clean negative space for headline and CTA.
Constraints: {_no_text}. Avoid fake UI text, random icons, unreadable typography, watermarks, and overly abstract gradients.
Output: High-quality hero background suitable for a landing page or SaaS website.`
  },
  {
    id: "tpl_promo_poster",
    name: "节日促销海报",
    scene: "promo_poster",
    description: "节日 / 大促主题营销视觉",
    category: "marketing",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1024x1536",
      ...commonParams
    },
    fields: [
      {
        key: "festival",
        label: "节日 / 活动",
        type: "select",
        required: true,
        defaultValue: "春节",
        options: ["春节", "中秋", "双 11", "618", "圣诞", "情人节", "母亲节", "新年"],
        placement: "primary"
      },
      {
        key: "product_type",
        label: "主推产品",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "color_mood",
        label: "色彩氛围",
        type: "segmented",
        required: false,
        defaultValue: "喜庆暖色",
        options: ["喜庆暖色", "简约高级", "活力鲜亮", "节日蓝"],
        placement: "primary"
      },
      {
        key: "elements",
        label: "节日元素",
        type: "multi-select",
        required: false,
        defaultValue: [],
        options: ["礼品", "灯笼", "烟花", "雪花", "玫瑰", "月亮", "彩带", "气球"],
        placement: "advanced",
        hint: "多选叠加，谨慎选 2-3 项避免画面拥挤"
      },
      {
        key: "leave_text_space",
        label: "预留文案区",
        type: "boolean",
        required: false,
        defaultValue: true,
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a festival commercial promotional poster.

Festival: {festival} season.
Featured product: {product_type}.
Color mood: {color_mood}, evocative of the festival atmosphere.
Festival elements: {elements}, used tastefully without overcrowding.
Layout: Vertical poster composition with strong visual hierarchy.
Constraints: {_no_text}. Avoid generic stock-poster look, clutter, and over-saturation.
Output: Premium festival promotional visual ready for e-commerce campaign use.`
  },
  {
    id: "tpl_feed_ad",
    name: "信息流 / 直播广告",
    scene: "feed_ad",
    description: "短视频信息流 / 直播间静态广告",
    category: "marketing",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1024x1536",
      ...commonParams
    },
    fields: [
      {
        key: "product_type",
        label: "推广产品",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "cta_position",
        label: "CTA 区域",
        type: "segmented",
        required: false,
        defaultValue: "底部",
        options: ["顶部", "底部", "中央"],
        placement: "primary"
      },
      {
        key: "urgency",
        label: "紧迫感",
        type: "segmented",
        required: false,
        defaultValue: "促销",
        options: ["促销", "紧迫", "平和", "信任"],
        placement: "primary"
      },
      {
        key: "background_style",
        label: "背景调",
        type: "select",
        required: false,
        defaultValue: "鲜亮活泼",
        options: ["鲜亮活泼", "深色高对比", "暖色温馨", "冷色专业"],
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a feed / livestream commercial ad image.

Product: {product_type}.
Layout: Vertical mobile-first composition with clear {cta_position} space for the call-to-action.
Tone: {urgency} energy, polished commercial finish.
Background: {background_style}, supporting but not distracting from the product.
Lighting: Bright, attention-grabbing, with strong product visibility.
Constraints: {_no_text}. No clutter, no fake price tags, no random badges.
Output: Eye-catching mobile feed ad image ready for headline overlay.`
  },

  // ============ 内容封面 (3) ============
  {
    id: "tpl_social_cover",
    name: "社媒封面",
    scene: "social_cover",
    description: "竖版内容封面，适合移动端信息流",
    category: "content",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1024x1536",
      ...commonParams
    },
    fields: [
      {
        key: "platform",
        label: "平台",
        type: "select",
        required: true,
        defaultValue: "小红书",
        options: ["小红书", "抖音", "快手", "公众号", "Instagram", "TikTok"],
        placement: "primary"
      },
      {
        key: "topic",
        label: "主题",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "style",
        label: "风格",
        type: "segmented",
        required: false,
        defaultValue: "清爽高级",
        options: ["清爽高级", "卡通风", "真实摄影", "杂志感"],
        placement: "primary"
      },
      {
        key: "subject",
        label: "主体",
        type: "text",
        required: false,
        defaultValue: "产品或人物",
        placement: "advanced"
      },
      {
        key: "text_space",
        label: "标题区域",
        type: "segmented",
        required: false,
        defaultValue: "顶部留白",
        options: ["顶部留白", "底部留白", "左侧留白", "右侧留白"],
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a social media cover image for {platform}.

Topic: {topic}.
Subject: {subject}.
Style: {style}, visually attractive, clean and high-quality.
Composition: Vertical cover layout with {text_space} reserved for title text.
Lighting: Bright and polished, suitable for mobile feed.
Constraints: {_no_text}. Avoid clutter, fake typography, watermarks, low-resolution details.
Output: Eye-catching cover image ready for social media publishing.`
  },
  {
    id: "tpl_wechat_header",
    name: "公众号头图",
    scene: "wechat_header",
    description: "公众号文章头图（横版 16:9）",
    category: "content",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1536x1024",
      ...commonParams
    },
    fields: [
      {
        key: "article_topic",
        label: "文章主题",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "tone",
        label: "调性",
        type: "segmented",
        required: false,
        defaultValue: "深度严肃",
        options: ["深度严肃", "轻松活泼", "商业财经", "生活方式"],
        placement: "primary"
      },
      {
        key: "leave_title_space",
        label: "预留标题区",
        type: "boolean",
        required: false,
        defaultValue: true,
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a WeChat article header image (16:9 horizontal).

Article topic: {article_topic}.
Tone: {tone}, matching the editorial voice of a professional Chinese WeChat publication.
Composition: Clean, premium, with breathing room above for the article title overlay.
Lighting: Soft and editorial, polished for mobile reading.
Constraints: {_no_text}. No distracting elements, no fake watermarks, no unreadable foreign text.
Output: Premium WeChat article header image ready for Chinese readers on mobile.`
  },
  {
    id: "tpl_youtube_thumb",
    name: "YouTube / 视频缩略图",
    scene: "youtube_thumb",
    description: "短视频 / 长视频封面缩略图",
    category: "content",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1536x1024",
      ...commonParams
    },
    fields: [
      {
        key: "video_topic",
        label: "视频主题",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "facial_expression",
        label: "表情",
        type: "select",
        required: false,
        defaultValue: "无人物",
        options: ["惊讶", "期待", "严肃", "开心", "无人物"],
        placement: "primary"
      },
      {
        key: "color_contrast",
        label: "色彩对比",
        type: "segmented",
        required: false,
        defaultValue: "高对比",
        options: ["高对比", "中对比", "柔和"],
        placement: "primary"
      },
      {
        key: "text_overlay_space",
        label: "预留标题区",
        type: "boolean",
        required: false,
        defaultValue: true,
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a YouTube / video thumbnail image (16:9 horizontal).

Video topic: {video_topic}.
Subject expression: {facial_expression}.
Color treatment: {color_contrast}, optimized for mobile feed thumbnail visibility.
Composition: Strong focal point, with space reserved for thumbnail title overlay.
Lighting: Bold and clear, with high mobile-feed legibility.
Constraints: {_no_text}. Avoid fake clickbait labels, low-quality stock photo look, illegible foreign text.
Output: High-CTR thumbnail image suitable for YouTube / B 站 / Bilibili / TikTok long-form video.`
  },

  // ============ 人像 / 品牌 (3) ============
  {
    id: "tpl_portrait_avatar",
    name: "人像头像",
    scene: "portrait",
    description: "商务头像或个人资料图",
    category: "portrait_brand",
    requiresImage: true,
    enabledForMvp: true,
    defaultParams: {
      size: "1024x1024",
      ...commonParams
    },
    fields: [
      {
        key: "portrait_type",
        label: "头像类型",
        type: "segmented",
        required: true,
        defaultValue: "商务头像",
        options: ["商务头像", "社交头像", "创始人", "简历头像"],
        placement: "primary"
      },
      {
        key: "background",
        label: "背景",
        type: "select",
        required: false,
        defaultValue: "干净中性",
        options: ["干净中性", "浅灰摄影棚", "办公室虚化", "纯色背景"],
        placement: "primary"
      },
      {
        key: "lighting",
        label: "光线",
        type: "select",
        required: false,
        defaultValue: "柔和正面光",
        options: ["柔和正面光", "自然窗光", "经典伦勃朗光", "明亮平光"],
        placement: "advanced"
      },
      {
        key: "style",
        label: "风格",
        type: "segmented",
        required: false,
        defaultValue: "真实专业",
        options: ["真实专业", "自然生活", "高级商业"],
        placement: "advanced"
      },
      {
        key: "identity_strict",
        label: "严格保留身份",
        type: "boolean",
        required: false,
        defaultValue: true,
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a professional portrait image.

Portrait type: {portrait_type}.
Background: {background}.
Lighting: {lighting}.
Style: {style}, polished but natural.
Constraints: Preserve the original facial identity, age, ethnicity, and key personal features. Avoid plastic skin, distorted eyes, extra fingers. {_no_text}.
Output: Clean professional profile portrait suitable for business use.`
  },
  {
    id: "tpl_brand_poster",
    name: "品牌海报",
    scene: "brand_poster",
    description: "品牌调性海报背景",
    category: "portrait_brand",
    requiresImage: false,
    enabledForMvp: true,
    defaultParams: {
      size: "1024x1536",
      ...commonParams
    },
    fields: [
      {
        key: "brand_mood",
        label: "品牌调性",
        type: "text",
        required: true,
        defaultValue: "高端、可信、现代",
        placement: "primary"
      },
      {
        key: "main_subject",
        label: "主体",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "brand_color",
        label: "品牌色",
        type: "color",
        required: false,
        placement: "primary"
      },
      {
        key: "poster_scene",
        label: "海报场景",
        type: "text",
        required: false,
        defaultValue: "极简商业视觉",
        placement: "advanced"
      },
      {
        key: "text_policy",
        label: "文字策略",
        type: "select",
        required: false,
        defaultValue: "留白不加字",
        options: ["留白不加字", "中央主体不加字", "底部留白不加字"],
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Create a premium brand poster visual.

Brand mood: {brand_mood}.
Subject: {main_subject}.
Color direction: Use {brand_color} as an accent if provided, keep the overall palette professional.
Scene: {poster_scene}.
Composition: Strong visual hierarchy, clean layout, suitable for poster design.
Constraints: {_no_text}. {text_policy}. Avoid unreadable text, random logos, watermarks, or clutter.
Output: High-end brand poster background ready for final copywriting.`
  },
  {
    id: "tpl_mask_local_edit",
    name: "局部编辑",
    scene: "local_edit",
    description: "只改涂抹区域，保留其它内容",
    category: "portrait_brand",
    requiresImage: true,
    requiresMask: true,
    enabledForMvp: true,
    defaultParams: {
      size: "1024x1024",
      ...commonParams
    },
    fields: [
      {
        key: "edit_target",
        label: "修改区域",
        type: "text",
        required: true,
        placement: "primary"
      },
      {
        key: "desired_change",
        label: "目标效果",
        type: "text",
        required: true,
        defaultValue: "替换为干净自然的商业画面",
        placement: "primary"
      },
      {
        key: "preserve_strict",
        label: "严格保留未涂抹区",
        type: "boolean",
        required: false,
        defaultValue: true,
        placement: "advanced"
      },
      CONST_NO_TEXT
    ],
    promptTemplate: `Edit only the masked area of the input image.

Target area: {edit_target}.
Desired change: {desired_change}.
Mask rule: Use the provided mask as the strict edit boundary.
Preservation: Preserve every unmasked pixel as much as possible — keep the unmasked subject, material, text, edges, lighting and composition.
Constraints: Do not alter unmasked product shape, logo, label, material, color, proportions, camera angle, or surrounding details. {_no_text} unless explicitly requested.
Output: A realistic local edit that blends cleanly with the original image.`
  }
];

export function getCommercialTemplate(id: string) {
  return commercialTemplates.find((template) => template.id === id);
}

export function getCommercialTemplatesByCategory() {
  const groups: Record<CommercialTemplateCategory, CommercialTemplate[]> = {
    ecommerce: [],
    marketing: [],
    content: [],
    portrait_brand: []
  };
  for (const template of commercialTemplates) {
    groups[template.category].push(template);
  }
  return groups;
}

/**
 * 渲染模板：把字段值代入 promptTemplate 占位符（plan slug
 * quiet-glittering-prism · Cut 3 升级）。
 *
 * 字段类型映射：
 * - text / select / segmented / color → 直接 string
 * - multi-select → string[].join(", ")（空数组 → 空 → 行被过滤）
 * - slider → number → String(number)
 * - boolean → "yes" / "no"
 * - constant → 用 field.constantValue（不依赖 fieldValues）
 */
export function renderCommercialPrompt(
  templateId: string,
  fieldValues: Record<
    string,
    string | boolean | string[] | number | undefined
  >
): RenderedCommercialPrompt {
  const template = getCommercialTemplate(templateId);

  if (!template) {
    throw new Error(`Unknown commercial template: ${templateId}`);
  }

  const values = Object.fromEntries(
    template.fields.map((field) => [
      field.key,
      resolveFieldValue(field, fieldValues[field.key])
    ])
  );

  const prompt = template.promptTemplate
    .replace(/\{([a-zA-Z_]+)\}/g, (_match, key: string) => values[key] ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    // 过滤掉只剩 "Label:" 没值的行（multi-select 空数组等）
    .filter((line) => !line.match(/:\s*\.$/) && !line.match(/:\s*$/))
    .join("\n")
    .trim();

  return {
    prompt,
    params: {
      ...imageGenerationDefaults,
      ...template.defaultParams
    }
  };
}

function resolveFieldValue(
  field: CommercialTemplateField,
  rawValue: string | boolean | string[] | number | undefined
): string {
  // constant：直接用 constantValue，忽略 fieldValues
  if (field.type === "constant") {
    return field.constantValue ?? "";
  }

  // 优先 rawValue，其次 defaultValue（按类型 fallback）
  let value: string | boolean | string[] | number | undefined = rawValue;
  if (value === undefined || value === null || value === "") {
    if (field.type === "multi-select") {
      value = Array.isArray(field.defaultValue) ? field.defaultValue : [];
    } else {
      value = field.defaultValue;
    }
  }

  if (Array.isArray(value)) {
    // multi-select
    return value.length > 0 ? value.join(", ") : "";
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}
