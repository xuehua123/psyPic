import { z } from "zod";

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(8).max(200);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: z.string().trim().min(1).max(80).optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});
