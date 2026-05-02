import { describe, expect, it } from "vitest";
import {
  createNodeFromHistory,
  createVersionNode,
  summarizeNodeParams,
  type CreatorVersionNode
} from "@/lib/creator/version-graph";
import type { ImageGenerationParams } from "@/lib/validation/image-params";

const baseParams: ImageGenerationParams = {
  prompt: "Create a premium product photo.",
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "medium",
  n: 1,
  output_format: "png",
  output_compression: null,
  background: "auto",
  moderation: "auto"
};

describe("creator version graph", () => {
  it("creates a root node from a generation result", () => {
    const node = createVersionNode({
      existingNodes: [],
      parentId: null,
      prompt: baseParams.prompt,
      params: baseParams,
      images: [
        {
          asset_id: "asset_root",
          url: "/api/assets/asset_root",
          format: "png"
        }
      ],
      requestId: "psypic_req_root",
      durationMs: 1200,
      source: "generation"
    });

    expect(node.parentId).toBeNull();
    expect(node.branchId).toBe(node.id);
    expect(node.branchLabel).toBe("主线");
    expect(node.depth).toBe(0);
    expect(node.images).toHaveLength(1);
  });

  it("creates a child node on the same branch when the parent has no children", () => {
    const root = createVersionNode({
      existingNodes: [],
      parentId: null,
      prompt: baseParams.prompt,
      params: baseParams,
      images: [],
      source: "generation"
    });
    const child = createVersionNode({
      existingNodes: [root],
      parentId: root.id,
      prompt: "Make it warmer.",
      params: { ...baseParams, prompt: "Make it warmer." },
      images: [],
      source: "edit"
    });

    expect(child.parentId).toBe(root.id);
    expect(child.branchId).toBe(root.branchId);
    expect(child.branchLabel).toBe(root.branchLabel);
    expect(child.depth).toBe(1);
  });

  it("creates a new branch when generating from a node that already has children", () => {
    const root = createVersionNode({
      existingNodes: [],
      parentId: null,
      prompt: baseParams.prompt,
      params: baseParams,
      images: [],
      source: "generation"
    });
    const firstChild = createVersionNode({
      existingNodes: [root],
      parentId: root.id,
      prompt: "Use a white background.",
      params: { ...baseParams, prompt: "Use a white background." },
      images: [],
      source: "generation"
    });
    const branchChild = createVersionNode({
      existingNodes: [root, firstChild],
      parentId: root.id,
      prompt: "Use a cartoon style.",
      params: { ...baseParams, prompt: "Use a cartoon style." },
      images: [],
      source: "generation"
    });

    expect(firstChild.branchId).toBe(root.branchId);
    expect(branchChild.parentId).toBe(root.id);
    expect(branchChild.branchId).not.toBe(firstChild.branchId);
    expect(branchChild.branchLabel).toBe("分支 2");
    expect(branchChild.depth).toBe(1);
  });

  it("imports old local history as root nodes without losing images", () => {
    const node = createNodeFromHistory({
      taskId: "task_history",
      prompt: "Old prompt",
      params: {
        model: "gpt-image-2",
        size: "1536x1024",
        quality: "high",
        n: 2,
        output_format: "webp",
        output_compression: 80,
        background: "auto",
        moderation: "auto"
      },
      thumbnailUrl: "/api/assets/asset_old",
      requestId: "psypic_req_old",
      durationMs: 900,
      totalTokens: 88,
      createdAt: "2026-05-02T00:00:00.000Z"
    });

    expect(node.parentId).toBeNull();
    expect(node.prompt).toBe("Old prompt");
    expect(node.params.size).toBe("1536x1024");
    expect(node.images).toEqual([
      {
        asset_id: "asset_old",
        url: "/api/assets/asset_old",
        format: "webp"
      }
    ]);
  });

  it("summarizes node params for the version stream", () => {
    const node: CreatorVersionNode = createVersionNode({
      existingNodes: [],
      parentId: null,
      prompt: baseParams.prompt,
      params: { ...baseParams, size: "1024x1536", quality: "high", n: 4 },
      images: [],
      source: "generation"
    });

    expect(summarizeNodeParams(node)).toBe("1024x1536 · high · 4 张 · png");
  });
});
