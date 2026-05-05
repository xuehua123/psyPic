import { describe, expect, it } from "vitest";
import {
  commercialSizePresets,
  findSizePresetById,
  groupSizePresetsByAspect,
  type CommercialSizeAspect
} from "@/lib/templates/commercial-size-presets";
import { GENERATION_SIZE_OPTIONS } from "@/lib/validation/image-params";

describe("commercial size presets", () => {
  it("expands to 11 platform-specific business presets (plan slug quiet-glittering-prism · Cut 2)", () => {
    expect(commercialSizePresets).toHaveLength(11);
  });

  it("every preset's size value is one of the 4 OpenAI gpt-image-2 supported sizes", () => {
    for (const preset of commercialSizePresets) {
      expect(GENERATION_SIZE_OPTIONS).toContain(preset.size);
    }
  });

  it("every preset has aspect ∈ {1:1, 16:9, 9:16, auto}", () => {
    const allowed: CommercialSizeAspect[] = ["1:1", "16:9", "9:16", "auto"];
    for (const preset of commercialSizePresets) {
      expect(allowed).toContain(preset.aspect);
    }
  });

  it("groups presets by aspect with sensible distribution", () => {
    const groups = groupSizePresetsByAspect();
    expect(groups["1:1"].length).toBeGreaterThanOrEqual(2);
    expect(groups["16:9"].length).toBeGreaterThanOrEqual(3);
    expect(groups["9:16"].length).toBeGreaterThanOrEqual(3);
    expect(groups.auto.length).toBe(1);
  });

  it("every preset id is unique", () => {
    const ids = commercialSizePresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findSizePresetById returns matching preset or undefined", () => {
    expect(findSizePresetById("ecommerce_main")?.size).toBe("1024x1024");
    expect(findSizePresetById("xhs_cover")?.aspect).toBe("9:16");
    expect(findSizePresetById("auto")?.size).toBe("auto");
    expect(findSizePresetById("__missing__")).toBeUndefined();
  });

  it("preserves business labels for the 3 most common platforms (regression: ecommerce / banner / social)", () => {
    const ecommerce = findSizePresetById("ecommerce_main");
    expect(ecommerce?.label).toBe("电商主图");
    expect(ecommerce?.size).toBe("1024x1024");

    const banner = findSizePresetById("ad_banner_wide");
    expect(banner?.label).toBe("广告 Banner");
    expect(banner?.size).toBe("1536x1024");

    const xhs = findSizePresetById("xhs_cover");
    expect(xhs?.label).toBe("小红书封面");
    expect(xhs?.size).toBe("1024x1536");
  });
});
