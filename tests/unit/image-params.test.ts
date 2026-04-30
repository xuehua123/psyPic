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

  it("only accepts documented MVP size options", () => {
    expect(GENERATION_SIZE_OPTIONS).toEqual([
      "auto",
      "1024x1024",
      "1536x1024",
      "1024x1536"
    ]);

    const result = parseGenerationParams({
      prompt: "Create a clean product image.",
      size: "999x999"
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected invalid parameters");
    }

    expect(result.error.details.field).toBe("size");
  });
});
