import { describe, expect, it } from "vitest";
import { commercialSizePresets } from "@/lib/templates/commercial-size-presets";
import { GENERATION_SIZE_OPTIONS } from "@/lib/validation/image-params";

describe("commercial size presets", () => {
  it("maps business scene labels to one allowed target size each", () => {
    expect(commercialSizePresets).toEqual([
      {
        id: "ecommerce_square",
        label: "电商主图",
        size: "1024x1024"
      },
      {
        id: "ad_banner_landscape",
        label: "广告 Banner",
        size: "1536x1024"
      },
      {
        id: "social_cover_portrait",
        label: "社媒封面",
        size: "1024x1536"
      }
    ]);

    for (const preset of commercialSizePresets) {
      expect(GENERATION_SIZE_OPTIONS).toContain(preset.size);
    }
  });
});
