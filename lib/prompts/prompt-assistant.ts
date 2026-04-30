import { getCommercialTemplate } from "@/lib/templates/commercial-templates";

export type PromptAssistMode = "text" | "image";

export type PromptAssistInput = {
  prompt: string;
  mode: PromptAssistMode;
  templateId?: string;
};

export type PromptAssistResult = {
  optimized_prompt: string;
  sections: string[];
  preservation_notes: string[];
};

export function assistCommercialPrompt(input: PromptAssistInput): PromptAssistResult {
  const sourcePrompt = input.prompt.trim();
  const template = input.templateId
    ? getCommercialTemplate(input.templateId)
    : undefined;
  const scene = template?.name ?? "Commercial visual";
  const preservationNotes =
    input.mode === "image"
      ? ["主体轮廓", "产品比例", "品牌标识", "材质纹理", "文字标签"]
      : [];
  const constraints =
    input.mode === "image"
      ? "Keep the reference image subject, product shape, logo, label, material, color, proportions, and camera angle unchanged. Avoid fake text, watermarks, distorted details, clutter, and low quality."
      : "Avoid fake typography, random logos, watermarks, distorted details, clutter, and low quality. Do not render text unless explicitly requested.";

  const optimizedPrompt = [
    "Create a high-quality commercial image.",
    "",
    `Scene: ${scene}.`,
    `Subject: ${sourcePrompt}.`,
    "Background: Clean, commercially usable, aligned with the subject and platform.",
    "Lighting: Polished commercial lighting with natural shadows and clear depth.",
    "Composition: Strong visual hierarchy, clear main subject, enough negative space for design use.",
    "Style: Professional, visually attractive, refined, and ready for marketing.",
    `Constraints: ${constraints}`,
    "Output: A production-ready commercial image brief for GPT Image generation."
  ].join("\n");

  return {
    optimized_prompt: optimizedPrompt,
    sections: [
      "Scene",
      "Subject",
      "Background",
      "Lighting",
      "Composition",
      "Style",
      "Constraints",
      "Output"
    ],
    preservation_notes: preservationNotes
  };
}
