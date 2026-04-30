import { z } from "zod";

export const importExchangeSchema = z.object({
  import_code: z.string().trim().min(1)
});

export const manualKeySchema = z.object({
  base_url: z.string().trim().url(),
  api_key: z.string().trim().min(1),
  default_model: z.literal("gpt-image-2").default("gpt-image-2")
});
