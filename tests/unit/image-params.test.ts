import { describe, expect, it } from "vitest";
import {
  GENERATION_SIZE_OPTIONS,
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

  it("rejects transparent backgrounds for gpt-image-2", () => {
    const result = parseGenerationParams({
      prompt: "Create a clean product image.",
      background: "transparent"
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected invalid parameters");
    }

    expect(result.error.details.field).toBe("background");
  });

  it("enforces the MVP max n limit", () => {
    const result = parseGenerationParams({
      prompt: "Create a clean product image.",
      n: 5
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected invalid parameters");
    }

    expect(result.error.details.field).toBe("n");
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
    const invalidSizes = ["999 by 999", "5000x1024", "4096x1024"];

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
