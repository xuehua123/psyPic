import { describe, expect, it } from "vitest";
import {
  commercialTemplates,
  getCommercialTemplate,
  renderCommercialPrompt
} from "@/lib/templates/commercial-templates";

describe("commercial template seed library", () => {
  it("initializes the first batch from docs/18", () => {
    expect(commercialTemplates.map((template) => template.id)).toEqual([
      "tpl_ecommerce_main",
      "tpl_product_background",
      "tpl_lifestyle_scene",
      "tpl_ad_banner",
      "tpl_social_cover",
      "tpl_mask_local_edit",
      "tpl_brand_poster",
      "tpl_portrait_avatar",
      "tpl_app_hero"
    ]);
  });

  it("marks the MVP commercial templates as enabled before public trial", () => {
    const mvpIds = commercialTemplates
      .filter((template) => template.enabledForMvp)
      .map((template) => template.id);

    expect(mvpIds).toEqual([
      "tpl_ecommerce_main",
      "tpl_product_background",
      "tpl_lifestyle_scene",
      "tpl_ad_banner",
      "tpl_social_cover",
      "tpl_mask_local_edit"
    ]);
  });

  it("renders ecommerce prompts from structured fields without unresolved placeholders", () => {
    const rendered = renderCommercialPrompt("tpl_ecommerce_main", {
      product_type: "透明玻璃香水瓶",
      background_style: "高级灰摄影棚",
      lighting: "柔和侧光",
      composition: "居中构图",
      text_policy: "不添加文字"
    });

    expect(rendered.prompt).toContain(
      "Create a premium ecommerce main product image."
    );
    expect(rendered.prompt).toContain("透明玻璃香水瓶");
    expect(rendered.prompt).not.toMatch(/\{[a-z_]+\}/);
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
});
