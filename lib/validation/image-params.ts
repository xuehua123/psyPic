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
    n: z.number().int().min(1).max(4).default(imageGenerationDefaults.n),
    output_format: z
      .enum(outputFormatOptions)
      .default(imageGenerationDefaults.output_format),
    output_compression: z.number().int().min(1).max(100).nullable().default(null),
    background: z
      .enum(backgroundOptions)
      .default(imageGenerationDefaults.background),
    moderation: z
      .enum(moderationOptions)
      .default(imageGenerationDefaults.moderation)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.background === "transparent") {
      context.addIssue({
        code: "custom",
        path: ["background"],
        message: "gpt-image-2 暂不支持 transparent background"
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
