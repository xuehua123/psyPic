/**
 * SSE 流式响应解析 + JSON 帮手。纯函数。
 */

import type { GenerationImage } from "@/lib/creator/types";

export function parseSseBlock(block: string): { event: string; data: string } {
  const lines = block.split(/\r?\n/);
  const data: string[] = [];
  let event = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }

    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trim());
    }
  }

  return {
    event,
    data: data.join("\n")
  };
}

export function parseJsonRecord(input: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(input);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseGenerationImage(
  input: Record<string, unknown> | null
): GenerationImage | null {
  const assetId = readString(input, "asset_id");
  const url = readString(input, "url");
  const format = readString(input, "format");

  if (!assetId || !url || !format) {
    return null;
  }

  return {
    asset_id: assetId,
    url,
    format
  };
}

export function parseGenerationImages(
  input: Record<string, unknown> | null
): GenerationImage[] {
  const images = input?.images;

  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image) => (isRecord(image) ? parseGenerationImage(image) : null))
    .filter((image): image is GenerationImage => image !== null);
}

export function parseUsage(input: Record<string, unknown> | null) {
  const usage = isRecord(input?.usage) ? (input?.usage as Record<string, unknown>) : {};

  return {
    input_tokens: readNumber(usage, "input_tokens") ?? 0,
    output_tokens: readNumber(usage, "output_tokens") ?? 0,
    total_tokens: readNumber(usage, "total_tokens") ?? 0,
    estimated_cost: readString(usage, "estimated_cost") ?? "0.0000"
  };
}

export function readString(
  input: Record<string, unknown> | null | undefined,
  key: string
): string | undefined {
  const value = input?.[key];
  return typeof value === "string" ? value : undefined;
}

export function readNumber(
  input: Record<string, unknown> | null | undefined,
  key: string
): number | undefined {
  const value = input?.[key];
  return typeof value === "number" ? value : undefined;
}

export function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
