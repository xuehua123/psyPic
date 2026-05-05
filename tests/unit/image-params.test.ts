import { describe, expect, it } from "vitest";
import {
  GENERATION_SIZE_OPTIONS,
  STYLE_OPTIONS,
  STYLE_LABEL,
  imageGenerationDefaults,
  parseGenerationParams
} from "@/lib/validation/image-params";

describe("image generation parameter schema", () => {
  it("fills MVP defaults for a minimal text-to-image request", () => {
    const result = parseGenerationParams({
      prompt: "Create a premium ecommerce product photo."
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected valid parameters");
    }

    expect(result.data).toEqual({
      ...imageGenerationDefaults,
      prompt: "Create a premium ecommerce product photo."
    });
    expect(result.data).not.toHaveProperty("stream");
    expect(result.data).not.toHaveProperty("input_fidelity");
  });

  it("rejects an empty prompt with a field-level error", () => {
    const result = parseGenerationParams({ prompt: "   " });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected invalid parameters");
    }

    expect(result.error.code).toBe("invalid_parameter");
    expect(result.error.details.field).toBe("prompt");
  });

  it("accepts transparent background when output_format is PNG (plan slug quiet-glittering-prism · Cut 1)", () => {
    const result = parseGenerationParams({
      prompt: "Create a clean product image.",
      background: "transparent",
      output_format: "png"
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected valid parameters");
    }

    expect(result.data.background).toBe("transparent");
    expect(result.data.output_format).toBe("png");
  });

  it("accepts transparent background with WebP", () => {
    const result = parseGenerationParams({
      prompt: "Create a clean product image.",
      background: "transparent",
      output_format: "webp"
    });

    expect(result.success).toBe(true);
  });

  it("rejects transparent background with JPEG (cross-field constraint)", () => {
    const result = parseGenerationParams({
      prompt: "Create a clean product image.",
      background: "transparent",
      output_format: "jpeg"
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected invalid parameters");
    }

    expect(result.error.details.field).toBe("background");
  });

  it("accepts the new product-level max n=10 (was 8)", () => {
    const result = parseGenerationParams({
      prompt: "Create a clean product image.",
      n: 10
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected valid parameters");
    }

    expect(result.data.n).toBe(10);
  });

  it("rejects n=11 (above OpenAI max)", () => {
    const result = parseGenerationParams({
      prompt: "Create a clean product image.",
      n: 11
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected invalid parameters");
    }

    expect(result.error.details.field).toBe("n");
  });

  it("accepts input_fidelity=high for edit requests", () => {
    const result = parseGenerationParams({
      prompt: "Edit the masked region.",
      input_fidelity: "high"
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected valid parameters");
    }

    expect(result.data.input_fidelity).toBe("high");
  });

  it("rejects invalid input_fidelity values", () => {
    const result = parseGenerationParams({
      prompt: "Edit something.",
      input_fidelity: "ultra"
    });

    expect(result.success).toBe(false);
  });

  it("STYLE_OPTIONS exposes 8 commercial styles with labels", () => {
    expect(STYLE_OPTIONS).toHaveLength(8);
    for (const style of STYLE_OPTIONS) {
      expect(STYLE_LABEL[style]).toBeTruthy();
    }
  });

  it("keeps documented preset size options and accepts normalized custom sizes", () => {
    expect(GENERATION_SIZE_OPTIONS).toEqual([
      "auto",
      "1024x1024",
      "1536x1024",
      "1024x1536"
    ]);

    const exactCustom = parseGenerationParams({
      prompt: "Create a clean product image.",
      size: "2048x1024"
    });

    expect(exactCustom.success).toBe(true);
    if (!exactCustom.success) {
      throw new Error("expected valid custom size");
    }

    expect(exactCustom.data.size).toBe("2048x1024");

    const roundedCustom = parseGenerationParams({
      prompt: "Create a clean product image.",
      size: "1501x999"
    });

    expect(roundedCustom.success).toBe(true);
    if (!roundedCustom.success) {
      throw new Error("expected custom size to be normalized");
    }

    expect(roundedCustom.data.size).toBe("1504x992");
  });

  it("rejects malformed, oversized and extreme custom sizes", () => {
    const invalidSizes = [
      "999 by 999",
      "5000x1024",
      "4097x2048",
      "63x64",
      "4096x1024"
    ];

    for (const size of invalidSizes) {
      const result = parseGenerationParams({
        prompt: "Create a clean product image.",
        size
      });

      expect(result.success).toBe(false);
      if (result.success) {
        throw new Error(`expected invalid size ${size}`);
      }

      expect(result.error.details.field).toBe("size");
    }
  });
});
