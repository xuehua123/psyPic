import { describe, expect, it } from "vitest";
import { savePromptFavorite } from "@/lib/prompts/prompt-favorites";

describe("prompt favorites", () => {
  it("creates a prompt favorite item without storing secrets", async () => {
    const item = await savePromptFavorite({
      prompt: "Create a premium ecommerce main product image.",
      templateId: "tpl_ecommerce_main",
      mode: "text"
    });

    expect(item.id).toMatch(/^pf_/);
    expect(item.title).toBe("Create a premium ecommerce main product image.");
    expect(item.prompt).toContain("premium ecommerce");
    expect(JSON.stringify(item)).not.toContain("api_key");
  });
});
