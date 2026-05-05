import { z } from "zod";

export const GENERATION_SIZE_OPTIONS = [
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536"
] as const;

const MIN_CUSTOM_DIMENSION = 64;
const MAX_CUSTOM_DIMENSION = 4096;
const MAX_CUSTOM_ASPECT_RATIO = 3;
const qualityOptions = ["auto", "low", "medium", "high"] as const;
const outputFormatOptions = ["png", "jpeg", "webp"] as const;
const backgroundOptions = ["auto", "opaque", "transparent"] as const;
const moderationOptions = ["auto", "low"] as const;
const inputFidelityOptions = ["high", "low"] as const;

/**
 * 风格 / 介质 / 渲染语言（plan slug quiet-glittering-prism · Cut 1）。
 *
 * 注意：这不是 OpenAI API 参数 —— gpt-image-1/2 不接受 `style` 字段；
 * 它是**前端 UI 偏好**，由 prompt 渲染层在 prompt 末尾注入「Style: ...」。
 * 因此不进 generationSchema，仅 export type 给 Context 与 prompt 渲染共享。
 */
export const STYLE_OPTIONS = [
  "photography",
  "illustration",
  "3d",
  "hand-drawn",
  "line-art",
  "pixel",
  "oil-painting",
  "magazine"
] as const;

export type Style = (typeof STYLE_OPTIONS)[number];

export const STYLE_LABEL: Record<Style, string> = {
  photography: "商业摄影",
  illustration: "插画",
  "3d": "3D 渲染",
  "hand-drawn": "手绘",
  "line-art": "线稿",
  pixel: "像素艺术",
  "oil-painting": "油画",
  magazine: "杂志感"
};

export const STYLE_PROMPT_HINT: Record<Style, string> = {
  photography: "high-end commercial photography, realistic lighting and material",
  illustration: "stylized commercial illustration, clean vector-like shapes",
  "3d": "high-quality 3D render, soft global illumination, polished surfaces",
  "hand-drawn": "hand-drawn artwork, organic strokes, paper texture",
  "line-art": "minimal line art, mono-color contour, generous negative space",
  pixel: "8-bit / 16-bit pixel art aesthetic with clean dithering",
  "oil-painting": "oil painting on canvas, visible brush texture, gallery-grade lighting",
  magazine: "magazine editorial photography, bold composition, premium print look"
};

export const imageGenerationDefaults = {
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "medium",
  n: 1,
  output_format: "png",
  output_compression: null,
  background: "auto",
  moderation: "auto"
} as const;

const generationSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(1, { error: "Prompt 不能为空" }),
    model: z.literal("gpt-image-2").default(imageGenerationDefaults.model),
    size: z
      .string()
      .trim()
      .default(imageGenerationDefaults.size)
      .transform((value, context) => normalizeGenerationSize(value, context)),
    quality: z.enum(qualityOptions).default(imageGenerationDefaults.quality),
    // n 上限 8 → 10（plan slug quiet-glittering-prism · Cut 1）。
    // 与 OpenAI gpt-image-1/2 后端实际支持范围对齐（OpenAI 文档 1-10）。
    n: z.number().int().min(1).max(10).default(imageGenerationDefaults.n),
    output_format: z
      .enum(outputFormatOptions)
      .default(imageGenerationDefaults.output_format),
    output_compression: z.number().int().min(1).max(100).nullable().default(null),
    background: z
      .enum(backgroundOptions)
      .default(imageGenerationDefaults.background),
    moderation: z
      .enum(moderationOptions)
      .default(imageGenerationDefaults.moderation),
    /**
     * input_fidelity（plan slug quiet-glittering-prism · Cut 1）：
     * 仅图生图（/v1/images/edits）支持，控制 edit 对原图的特征保真度
     * （主要影响人脸 / 主体一致性）。OpenAI gpt-image-1 / 1.5 / 2 支持，
     * gpt-image-1-mini 不支持 —— 项目固定 model=gpt-image-2，可用。
     * generations endpoint 不传该字段，故 optional。
     */
    input_fidelity: z.enum(inputFidelityOptions).optional()
  })
  .strict()
  .superRefine((value, context) => {
    // background=transparent 在 gpt-image-2 实际可用（OpenAI 文档明确支持），
    // 但 JPEG 不支持透明通道。本轮解锁 transparent + 改为交叉校验（plan
    // slug quiet-glittering-prism · Cut 1）。
    if (
      value.background === "transparent" &&
      value.output_format === "jpeg"
    ) {
      context.addIssue({
        code: "custom",
        path: ["background"],
        message: "JPEG 不支持透明背景，请改用 PNG 或 WebP"
      });
    }

    if (value.output_format === "png" && value.output_compression !== null) {
      context.addIssue({
        code: "custom",
        path: ["output_compression"],
        message: "PNG 不传 output_compression"
      });
    }
  });

export type ImageGenerationParams = z.infer<typeof generationSchema>;

export type ParameterError = {
  code: "invalid_parameter";
  message: string;
  details: {
    field: string;
  };
};

export type ParseGenerationResult =
  | {
      success: true;
      data: ImageGenerationParams;
    }
  | {
      success: false;
      error: ParameterError;
    };

export function parseGenerationParams(input: unknown): ParseGenerationResult {
  const parsed = generationSchema.safeParse(input);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const firstIssue = parsed.error.issues[0];
  const field = firstIssue?.path[0]?.toString() ?? "request";

  return {
    success: false,
    error: {
      code: "invalid_parameter",
      message: firstIssue?.message ?? "参数错误",
      details: {
        field
      }
    }
  };
}

export function validateSizeTier(
  size: ImageGenerationParams["size"],
  maxSizeTier: "2K" | "4K"
) {
  if (size === "auto") {
    return { success: true as const };
  }

  const dimensions = parseDimensionString(size);

  if (!dimensions) {
    return { success: true as const };
  }

  const maxSide = maxSizeTier === "2K" ? 2048 : 4096;

  if (dimensions.width > maxSide || dimensions.height > maxSide) {
    return {
      success: false as const,
      message: `当前配置最大尺寸为 ${maxSizeTier}`,
      field: "size"
    };
  }

  return { success: true as const };
}

function normalizeGenerationSize(value: string, context: z.RefinementCtx) {
  if ((GENERATION_SIZE_OPTIONS as readonly string[]).includes(value)) {
    return value;
  }

  const dimensions = parseDimensionString(value);

  if (!dimensions) {
    context.addIssue({
      code: "custom",
      path: ["size"],
      message: "size 必须是 auto 或 宽x高"
    });
    return z.NEVER;
  }

  if (
    dimensions.width < MIN_CUSTOM_DIMENSION ||
    dimensions.height < MIN_CUSTOM_DIMENSION ||
    dimensions.width > MAX_CUSTOM_DIMENSION ||
    dimensions.height > MAX_CUSTOM_DIMENSION
  ) {
    context.addIssue({
      code: "custom",
      path: ["size"],
      message: `自定义尺寸边长必须在 ${MIN_CUSTOM_DIMENSION}-${MAX_CUSTOM_DIMENSION} 之间`
    });
    return z.NEVER;
  }

  const width = roundToMultipleOf16(dimensions.width);
  const height = roundToMultipleOf16(dimensions.height);

  const ratio = Math.max(width, height) / Math.min(width, height);

  if (ratio > MAX_CUSTOM_ASPECT_RATIO) {
    context.addIssue({
      code: "custom",
      path: ["size"],
      message: "自定义尺寸长宽比不能超过 3:1"
    });
    return z.NEVER;
  }

  return `${width}x${height}`;
}

function parseDimensionString(value: string) {
  const match = value.match(/^(\d{2,5})x(\d{2,5})$/);

  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2])
  };
}

function roundToMultipleOf16(value: number) {
  return Math.max(16, Math.round(value / 16) * 16);
}
