import type { ImageGenerationParams } from "@/lib/validation/image-params";

type GenerationSize = ImageGenerationParams["size"];

/**
 * 业务用尺寸预设（plan slug quiet-glittering-prism · Cut 2）：
 * 11 个常用平台 / 场景预设，全部映射到 OpenAI gpt-image-2 实际支持
 * 的 4 个 size 值（`auto / 1024x1024 / 1536x1024 / 1024x1536`）。
 *
 * 设计要点：
 * - 11 个预设按 `aspect` 字段分 4 组（1:1 / 16:9 / 9:16 / auto），便于
 *   QuickPickRow 的「比例」chip 展示视觉缩略
 * - `label` 直接是业务命名（如「小红书封面」），不暴露技术尺寸；尺寸
 *   字符串作为副信息显示在选项右侧
 * - 与历史 v0.4 仅 3 个预设相比，本轮扩到 11 是为了给用户提供按平台
 *   直接选择的入口，避免用户去查"小红书是什么尺寸"
 *
 * 不引入新 size 枚举值 —— OpenAI 后端就这 4 个；预设是"业务语义"。
 */
export type CommercialSizeAspect = "1:1" | "16:9" | "9:16" | "auto";

export type CommercialSizePreset = {
  id: string;
  label: string;
  size: GenerationSize;
  aspect: CommercialSizeAspect;
  /** 简短副标题，显示在 label 下方（如"1024×1024"）。 */
  hint: string;
};

export const commercialSizePresets: CommercialSizePreset[] = [
  // 1:1 方图（电商主图 / 社媒方图）
  {
    id: "ecommerce_main",
    label: "电商主图",
    size: "1024x1024",
    aspect: "1:1",
    hint: "1024×1024 · 淘宝 / 京东"
  },
  {
    id: "social_square",
    label: "Instagram / 朋友圈方图",
    size: "1024x1024",
    aspect: "1:1",
    hint: "1024×1024 · 信息流方图"
  },

  // 16:9 横版（广告 / 网站 hero / 视频封面）
  {
    id: "ad_banner_wide",
    label: "广告 Banner",
    size: "1536x1024",
    aspect: "16:9",
    hint: "1536×1024 · 横版广告"
  },
  {
    id: "web_hero",
    label: "网站 Hero / 信息流",
    size: "1536x1024",
    aspect: "16:9",
    hint: "1536×1024 · Landing Page"
  },
  {
    id: "youtube_thumb",
    label: "YouTube 缩略图",
    size: "1536x1024",
    aspect: "16:9",
    hint: "1536×1024 · 视频封面"
  },
  {
    id: "wechat_cover",
    label: "公众号封面",
    size: "1536x1024",
    aspect: "16:9",
    hint: "1536×1024 · 微信图文头图"
  },

  // 9:16 竖版（移动端社媒 / 海报）
  {
    id: "xhs_cover",
    label: "小红书封面",
    size: "1024x1536",
    aspect: "9:16",
    hint: "1024×1536 · 移动端竖版"
  },
  {
    id: "douyin_cover",
    label: "抖音 / TikTok 封面",
    size: "1024x1536",
    aspect: "9:16",
    hint: "1024×1536 · 短视频竖版"
  },
  {
    id: "story_vertical",
    label: "Stories / Reels 海报",
    size: "1024x1536",
    aspect: "9:16",
    hint: "1024×1536 · IG / FB Story"
  },
  {
    id: "poster_vertical",
    label: "竖版海报 / 招贴",
    size: "1024x1536",
    aspect: "9:16",
    hint: "1024×1536 · 印刷招贴"
  },

  // 自适应
  {
    id: "auto",
    label: "智能选择",
    size: "auto",
    aspect: "auto",
    hint: "由模型按 prompt 决定"
  }
];

/**
 * 按 aspect 分组返回，QuickPickRow 「比例」chip 用作分组下拉。
 */
export function groupSizePresetsByAspect(): Record<
  CommercialSizeAspect,
  CommercialSizePreset[]
> {
  return commercialSizePresets.reduce(
    (groups, preset) => {
      groups[preset.aspect].push(preset);
      return groups;
    },
    { "1:1": [], "16:9": [], "9:16": [], auto: [] } as Record<
      CommercialSizeAspect,
      CommercialSizePreset[]
    >
  );
}

export function findSizePresetById(id: string) {
  return commercialSizePresets.find((preset) => preset.id === id);
}
