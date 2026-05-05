import { describe, expect, it } from "vitest";
import {
  commercialTemplates,
  getCommercialTemplate,
  getCommercialTemplatesByCategory,
  renderCommercialPrompt,
  TEMPLATE_CATEGORY_LABEL
} from "@/lib/templates/commercial-templates";

describe("commercial template seed library", () => {
  it("expands to 15 templates across 4 categories (plan slug quiet-glittering-prism · Cut 3)", () => {
    expect(commercialTemplates).toHaveLength(15);
  });

  it("groups templates into 4 commercial categories with sensible distribution", () => {
    const groups = getCommercialTemplatesByCategory();
    expect(groups.ecommerce.length).toBeGreaterThanOrEqual(5);
    expect(groups.marketing.length).toBeGreaterThanOrEqual(4);
    expect(groups.content.length).toBeGreaterThanOrEqual(3);
    expect(groups.portrait_brand.length).toBeGreaterThanOrEqual(3);
  });

  it("has Chinese labels for every category", () => {
    expect(TEMPLATE_CATEGORY_LABEL.ecommerce).toBe("电商商品");
    expect(TEMPLATE_CATEGORY_LABEL.marketing).toBe("营销广告");
    expect(TEMPLATE_CATEGORY_LABEL.content).toBe("内容封面");
    expect(TEMPLATE_CATEGORY_LABEL.portrait_brand).toBe("人像 / 品牌");
  });

  it("marks all templates as enabled for MVP after the unlock", () => {
    const allEnabled = commercialTemplates.every((t) => t.enabledForMvp);
    expect(allEnabled).toBe(true);
  });

  it("preserves the original 6 MVP template IDs as a regression contract", () => {
    const ids = commercialTemplates.map((t) => t.id);
    for (const required of [
      "tpl_ecommerce_main",
      "tpl_product_background",
      "tpl_lifestyle_scene",
      "tpl_ad_banner",
      "tpl_social_cover",
      "tpl_mask_local_edit"
    ]) {
      expect(ids).toContain(required);
    }
  });

  it("introduces 5 new templates announced in plan", () => {
    const ids = commercialTemplates.map((t) => t.id);
    for (const newId of [
      "tpl_product_compare",
      "tpl_product_detail",
      "tpl_promo_poster",
      "tpl_feed_ad",
      "tpl_wechat_header"
    ]) {
      expect(ids).toContain(newId);
    }
  });

  it("renders ecommerce prompts from structured fields without unresolved placeholders", () => {
    const rendered = renderCommercialPrompt("tpl_ecommerce_main", {
      product_type: "透明玻璃香水瓶",
      background_style: "高级灰摄影棚",
      lighting: "柔和侧光",
      composition: "居中",
      modifiers: ["质感细腻", "色彩鲜明"]
    });

    expect(rendered.prompt).toContain(
      "Create a premium ecommerce main product image."
    );
    expect(rendered.prompt).toContain("透明玻璃香水瓶");
    expect(rendered.prompt).not.toMatch(/\{[a-zA-Z_]+\}/);
    expect(rendered.params).toMatchObject({
      model: "gpt-image-2",
      size: "1024x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
      background: "auto",
      moderation: "auto"
    });
  });

  it("renders multi-select fields as comma-joined strings", () => {
    const rendered = renderCommercialPrompt("tpl_ecommerce_main", {
      product_type: "玻璃瓶",
      modifiers: ["质感细腻", "胶片颗粒"]
    });
    expect(rendered.prompt).toContain("质感细腻, 胶片颗粒");
  });

  it("filters out empty multi-select lines from rendered prompt", () => {
    const rendered = renderCommercialPrompt("tpl_ad_banner", {
      campaign_theme: "新品",
      product_type: "电饭锅",
      mood_modifiers: [] // 空数组
    });
    // 空 modifiers 那一行被过滤（"Mood: ." 被 regex /:\s*\.$/ 拦截）
    expect(rendered.prompt).not.toMatch(/Mood:\s*\.$/m);
  });

  it("renders constant fields using their constantValue (UI 无表单输入)", () => {
    const rendered = renderCommercialPrompt("tpl_ecommerce_main", {
      product_type: "玻璃瓶"
    });
    expect(rendered.prompt).toContain("Do not render any text or watermark");
    expect(rendered.prompt).toContain("Do not change the product shape");
  });

  it("renders slider fields as their numeric value in prompt", () => {
    const rendered = renderCommercialPrompt("tpl_product_background", {
      product_type: "香水瓶",
      new_background: "高级灰商业摄影棚",
      shadow_intensity: 4
    });
    expect(rendered.prompt).toContain("shadow intensity 4/5");
  });

  it("keeps product background replacement as an image-required template", () => {
    const template = getCommercialTemplate("tpl_product_background");

    expect(template?.requiresImage).toBe(true);

    const rendered = renderCommercialPrompt("tpl_product_background", {
      product_type: "香水瓶",
      new_background: "高级灰商业摄影棚"
    });

    expect(rendered.prompt).toContain("Keep the original 香水瓶 exactly the same");
    expect(rendered.prompt).toContain("Do not change the product shape");
  });

  it("renders a mask local edit prompt that preserves unmasked areas", () => {
    const template = getCommercialTemplate("tpl_mask_local_edit");

    expect(template?.requiresImage).toBe(true);
    expect(template?.requiresMask).toBe(true);

    const rendered = renderCommercialPrompt("tpl_mask_local_edit", {
      edit_target: "替换瓶身背后的杂乱背景",
      desired_change: "高级灰摄影棚背景"
    });

    expect(rendered.prompt).toContain("Edit only the masked area");
    expect(rendered.prompt).toContain("替换瓶身背后的杂乱背景");
    expect(rendered.prompt).toContain("高级灰摄影棚背景");
    expect(rendered.prompt).toContain("Preserve every unmasked pixel");
  });

  it("every field has a placement (defaults to primary if omitted)", () => {
    for (const template of commercialTemplates) {
      for (const field of template.fields) {
        const placement = field.placement ?? "primary";
        expect(["primary", "advanced"]).toContain(placement);
      }
    }
  });

  it("constant fields all carry a constantValue", () => {
    for (const template of commercialTemplates) {
      for (const field of template.fields) {
        if (field.type === "constant") {
          expect(field.constantValue).toBeTruthy();
          expect(field.constantValue?.length).toBeGreaterThan(5);
        }
      }
    }
  });
});
