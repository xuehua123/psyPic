import {
  imageGenerationDefaults,
  type ImageGenerationParams
} from "@/lib/validation/image-params";

type TemplateFieldType = "text" | "select" | "boolean" | "color";

export type CommercialTemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  defaultValue?: string | boolean;
};

export type CommercialTemplate = {
  id: string;
  name: string;
  scene: string;
  description: string;
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

export const commercialTemplates: CommercialTemplate[] = [
  {
    id: "tpl_ecommerce_main",
    name: "电商主图",
    scene: "ecommerce",
    description: "干净棚拍、主体居中、适合商品列表",
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
        required: true
      },
      {
        key: "selling_point",
        label: "核心卖点",
        type: "text",
        required: false,
        defaultValue: "高级、干净、有质感"
      },
      {
        key: "background_style",
        label: "背景风格",
        type: "select",
        required: true,
        defaultValue: "高级灰摄影棚"
      },
      {
        key: "lighting",
        label: "光线",
        type: "select",
        required: false,
        defaultValue: "柔和侧光"
      },
      {
        key: "composition",
        label: "构图",
        type: "select",
        required: false,
        defaultValue: "居中构图"
      },
      {
        key: "leave_space",
        label: "是否留白",
        type: "boolean",
        required: false,
        defaultValue: true
      },
      {
        key: "text_policy",
        label: "文字策略",
        type: "select",
        required: false,
        defaultValue: "不添加文字"
      }
    ],
    promptTemplate: `Create a premium ecommerce main product image.

Scene: A clean commercial studio setup for {product_type}.
Subject: The product is the clear hero subject, sharp, realistic, premium, with visible details.
Background: {background_style}, minimal, uncluttered, suitable for ecommerce.
Lighting: {lighting}, soft shadows, controlled highlights.
Composition: {composition}, product occupies the visual center, balanced negative space.
Text: {text_policy}.
Constraints: Do not change the product shape, logo, label, material, color, or proportions. Do not add extra objects unless requested. Avoid distorted text, watermarks, low quality, clutter.
Output: High-end commercial product photography, ready for marketplace listing.`
  },
  {
    id: "tpl_product_background",
    name: "产品换背景",
    scene: "background_replacement",
    description: "保留主体，替换为商业摄影背景",
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
        required: true
      },
      {
        key: "new_background",
        label: "新背景",
        type: "text",
        required: true,
        defaultValue: "高级灰商业摄影棚"
      },
      {
        key: "surface",
        label: "承托表面",
        type: "select",
        required: false,
        defaultValue: "轻微反光台面"
      },
      {
        key: "shadow",
        label: "阴影",
        type: "select",
        required: false,
        defaultValue: "自然柔和阴影"
      },
      {
        key: "preserve_policy",
        label: "保留要求",
        type: "text",
        required: false,
        defaultValue: "保持产品主体完全一致"
      }
    ],
    promptTemplate: `Edit the image into a commercial product background replacement.

Subject: Keep the original {product_type} exactly the same.
Background: Replace the background with {new_background}.
Surface: Place the product on {surface}.
Lighting: Match the product with realistic studio lighting and {shadow}.
Constraints: {preserve_policy}. Do not change the product shape, logo, label, texture, color, or proportions. Do not add text. Keep edges clean and realistic.
Output: Professional ecommerce product image with a clean commercial background.`
  },
  {
    id: "tpl_lifestyle_scene",
    name: "商品场景图",
    scene: "lifestyle",
    description: "把商品放入可信的生活或使用场景",
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
        required: true
      },
      {
        key: "usage_scene",
        label: "使用场景",
        type: "text",
        required: true,
        defaultValue: "高端居家桌面"
      },
      {
        key: "mood",
        label: "氛围",
        type: "select",
        required: false,
        defaultValue: "温暖高级"
      },
      {
        key: "props",
        label: "道具",
        type: "text",
        required: false,
        defaultValue: "少量相关道具"
      },
      {
        key: "audience",
        label: "目标人群",
        type: "text",
        required: false,
        defaultValue: "年轻城市消费者"
      }
    ],
    promptTemplate: `Create a lifestyle commercial scene image for {product_type}.

Scene: {usage_scene}, designed for {audience}.
Subject: The product remains the main focus, realistic and premium.
Mood: {mood}, aspirational but believable.
Props: {props}, minimal and relevant, not distracting.
Lighting: Natural commercial lighting with depth and soft shadows.
Composition: Product clearly visible, enough negative space for marketing use.
Text: No text.
Constraints: Keep the product accurate. Avoid clutter, distorted objects, watermarks, unrealistic scale, extra logos.
Output: High-quality commercial lifestyle image.`
  },
  {
    id: "tpl_ad_banner",
    name: "广告 Banner",
    scene: "ad_banner",
    description: "横版广告视觉，预留文案空间",
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
        defaultValue: "新品上市"
      },
      {
        key: "product_type",
        label: "产品类型",
        type: "text",
        required: true
      },
      {
        key: "visual_style",
        label: "视觉风格",
        type: "select",
        required: false,
        defaultValue: "高端极简"
      },
      {
        key: "space_for_text",
        label: "文案留白位置",
        type: "select",
        required: false,
        defaultValue: "右侧留白"
      },
      {
        key: "platform",
        label: "平台",
        type: "select",
        required: false,
        defaultValue: "网站横幅"
      }
    ],
    promptTemplate: `Create a commercial advertising banner visual.

Campaign: {campaign_theme}.
Product: {product_type}.
Style: {visual_style}, polished, modern, premium.
Layout: Designed for {platform}, with clear {space_for_text} for marketing copy.
Lighting: Professional advertising lighting, strong visual hierarchy.
Text: Do not render text unless explicitly provided.
Constraints: Keep the product accurate. Avoid random letters, fake logos, watermarks, clutter, and distorted product details.
Output: A refined banner background ready for adding copy in design software.`
  },
  {
    id: "tpl_social_cover",
    name: "社媒封面",
    scene: "social_cover",
    description: "竖版内容封面，适合移动端信息流",
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
        defaultValue: "小红书"
      },
      {
        key: "topic",
        label: "主题",
        type: "text",
        required: true
      },
      {
        key: "style",
        label: "风格",
        type: "select",
        required: false,
        defaultValue: "清爽高级"
      },
      {
        key: "subject",
        label: "主体",
        type: "text",
        required: false,
        defaultValue: "产品或人物"
      },
      {
        key: "text_space",
        label: "标题区域",
        type: "select",
        required: false,
        defaultValue: "顶部留白"
      }
    ],
    promptTemplate: `Create a social media cover image for {platform}.

Topic: {topic}.
Subject: {subject}.
Style: {style}, visually attractive, clean and high-quality.
Composition: Vertical cover layout with {text_space} reserved for title text.
Lighting: Bright and polished, suitable for mobile feed.
Text: Do not generate text. Leave clean space for text overlay.
Constraints: Avoid clutter, fake typography, watermarks, low-resolution details.
Output: Eye-catching cover image ready for social media publishing.`
  },
  {
    id: "tpl_mask_local_edit",
    name: "局部编辑",
    scene: "local_edit",
    description: "只改涂抹区域，保留其它内容",
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
        required: true
      },
      {
        key: "desired_change",
        label: "目标效果",
        type: "text",
        required: true,
        defaultValue: "替换为干净自然的商业画面"
      },
      {
        key: "preserve_policy",
        label: "保留要求",
        type: "text",
        required: false,
        defaultValue: "保留未涂抹区域的主体、材质、文字、边缘、光影和构图"
      }
    ],
    promptTemplate: `Edit only the masked area of the input image.

Target area: {edit_target}.
Desired change: {desired_change}.
Mask rule: Use the provided mask as the strict edit boundary.
Preservation: {preserve_policy}. Preserve every unmasked pixel as much as possible.
Constraints: Do not alter unmasked product shape, logo, label, material, color, proportions, camera angle, or surrounding details. Do not add text unless explicitly requested.
Output: A realistic local edit that blends cleanly with the original image.`
  },
  {
    id: "tpl_brand_poster",
    name: "品牌海报",
    scene: "brand_poster",
    description: "品牌调性海报背景",
    requiresImage: false,
    enabledForMvp: false,
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
        defaultValue: "高端、可信、现代"
      },
      {
        key: "main_subject",
        label: "主体",
        type: "text",
        required: true
      },
      {
        key: "brand_color",
        label: "品牌色",
        type: "color",
        required: false
      },
      {
        key: "poster_scene",
        label: "海报场景",
        type: "text",
        required: false,
        defaultValue: "极简商业视觉"
      },
      {
        key: "text_policy",
        label: "文字策略",
        type: "select",
        required: false,
        defaultValue: "留白不加字"
      }
    ],
    promptTemplate: `Create a premium brand poster visual.

Brand mood: {brand_mood}.
Subject: {main_subject}.
Color direction: Use {brand_color} as an accent if provided, keep the overall palette professional.
Scene: {poster_scene}.
Composition: Strong visual hierarchy, clean layout, suitable for poster design.
Text: {text_policy}.
Constraints: Do not create unreadable text, random logos, watermarks, or clutter. Keep the image polished and commercially usable.
Output: High-end brand poster background ready for final copywriting.`
  },
  {
    id: "tpl_portrait_avatar",
    name: "人像头像",
    scene: "portrait",
    description: "商务头像或个人资料图",
    requiresImage: true,
    enabledForMvp: false,
    defaultParams: {
      size: "1024x1024",
      ...commonParams
    },
    fields: [
      {
        key: "portrait_type",
        label: "头像类型",
        type: "select",
        required: true,
        defaultValue: "商务头像"
      },
      {
        key: "background",
        label: "背景",
        type: "select",
        required: false,
        defaultValue: "干净中性背景"
      },
      {
        key: "lighting",
        label: "光线",
        type: "select",
        required: false,
        defaultValue: "柔和正面光"
      },
      {
        key: "style",
        label: "风格",
        type: "select",
        required: false,
        defaultValue: "真实专业摄影"
      },
      {
        key: "identity_policy",
        label: "身份保持",
        type: "text",
        required: false,
        defaultValue: "保持人物身份和五官一致"
      }
    ],
    promptTemplate: `Create a professional portrait image.

Portrait type: {portrait_type}.
Background: {background}.
Lighting: {lighting}.
Style: {style}, polished but natural.
Constraints: {identity_policy}. Do not change facial identity, age, ethnicity, or key personal features. Avoid plastic skin, distorted eyes, extra fingers, watermarks, or fake text.
Output: Clean professional profile portrait suitable for business use.`
  },
  {
    id: "tpl_app_hero",
    name: "应用/网站首屏视觉",
    scene: "app_hero",
    description: "网站或应用首屏商业视觉",
    requiresImage: false,
    enabledForMvp: false,
    defaultParams: {
      size: "1536x1024",
      ...commonParams
    },
    fields: [
      {
        key: "product_name",
        label: "产品/网站名称",
        type: "text",
        required: false
      },
      {
        key: "industry",
        label: "行业",
        type: "text",
        required: true,
        defaultValue: "AI 工具"
      },
      {
        key: "visual_metaphor",
        label: "视觉隐喻",
        type: "text",
        required: false,
        defaultValue: "高效创作工作台"
      },
      {
        key: "style",
        label: "风格",
        type: "select",
        required: false,
        defaultValue: "现代科技商业"
      },
      {
        key: "layout",
        label: "构图",
        type: "select",
        required: false,
        defaultValue: "横版首屏背景"
      }
    ],
    promptTemplate: `Create a hero visual for a commercial website or app.

Industry: {industry}.
Product: {product_name}.
Visual metaphor: {visual_metaphor}.
Style: {style}, premium, clear, modern, not cluttered.
Layout: {layout}, with clean negative space for headline and CTA.
Text: Do not render text.
Constraints: Avoid fake UI text, random icons, unreadable typography, watermarks, and overly abstract gradients.
Output: High-quality hero background suitable for a landing page or SaaS website.`
  }
];

export function getCommercialTemplate(id: string) {
  return commercialTemplates.find((template) => template.id === id);
}

export function renderCommercialPrompt(
  templateId: string,
  fieldValues: Record<string, string | boolean | undefined>
): RenderedCommercialPrompt {
  const template = getCommercialTemplate(templateId);

  if (!template) {
    throw new Error(`Unknown commercial template: ${templateId}`);
  }

  const values = Object.fromEntries(
    template.fields.map((field) => [
      field.key,
      normalizeTemplateValue(fieldValues[field.key], field.defaultValue)
    ])
  );

  const prompt = template.promptTemplate
    .replace(/\{([a-z_]+)\}/g, (_match, key: string) => values[key] ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
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

function normalizeTemplateValue(
  value: string | boolean | undefined,
  defaultValue: string | boolean | undefined
) {
  const resolvedValue = value ?? defaultValue ?? "";

  if (typeof resolvedValue === "boolean") {
    return resolvedValue ? "yes" : "no";
  }

  return resolvedValue.trim();
}
