import { z } from "zod";

export const GENERATION_SIZE_OPTIONS = [
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536"
] as const;

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
    size: z.enum(GENERATION_SIZE_OPTIONS).default(imageGenerationDefaults.size),
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
