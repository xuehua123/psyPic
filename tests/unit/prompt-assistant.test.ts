import { describe, expect, it } from "vitest";
import { assistCommercialPrompt } from "@/lib/prompts/prompt-assistant";

describe("assistCommercialPrompt", () => {
  it("turns Chinese intent into a structured commercial prompt", () => {
    const result = assistCommercialPrompt({
      prompt: "小红书首页爆款图。AI 生图社区相关的，卡通风",
      mode: "text",
      templateId: "tpl_social_cover"
    });

    expect(result.optimized_prompt).toContain(
      "Create a high-quality commercial image."
    );
    expect(result.optimized_prompt).toContain("AI 生图社区");
    expect(result.optimized_prompt).toContain("Composition:");
    expect(result.optimized_prompt).toContain("Constraints:");
    expect(result.optimized_prompt).not.toMatch(/\{[a-z_]+\}/);
  });

  it("adds subject preservation guidance for image edits", () => {
    const result = assistCommercialPrompt({
      prompt: "把背景换成高级灰棚拍",
      mode: "image",
      templateId: "tpl_product_background"
    });

    expect(result.optimized_prompt).toContain("Keep the reference image subject");
    expect(result.preservation_notes).toContain("主体轮廓");
  });
});
