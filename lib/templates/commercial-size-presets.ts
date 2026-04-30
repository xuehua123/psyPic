import type { ImageGenerationParams } from "@/lib/validation/image-params";

type GenerationSize = ImageGenerationParams["size"];

export type CommercialSizePreset = {
  id: string;
  label: string;
  size: GenerationSize;
};

export const commercialSizePresets: CommercialSizePreset[] = [
  {
    id: "ecommerce_square",
    label: "电商主图",
    size: "1024x1024"
  },
  {
    id: "ad_banner_landscape",
    label: "广告 Banner",
    size: "1536x1024"
  },
  {
    id: "social_cover_portrait",
    label: "社媒封面",
    size: "1024x1536"
  }
];
