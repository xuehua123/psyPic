import { describe, expect, it } from "vitest";

import {
  injectWorkbenchContext,
  appendWorkbenchContextToFormData,
  type GenerationWorkbenchContext
} from "@/lib/creator/generation-context";

const baseParams = {
  prompt: "A beautiful sunset",
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "medium",
  n: 1,
  output_format: "png"
};

const fullContext: GenerationWorkbenchContext = {
  projectId: "proj_123",
  sessionId: "sess_456",
  parentVersionNodeId: "vn_789"
};

describe("injectWorkbenchContext (JSON body)", () => {
  it("injects project_id, session_id, parent_version_node_id when context exists", () => {
    const result = injectWorkbenchContext(baseParams, fullContext);

    expect(result).toMatchObject({
      ...baseParams,
      project_id: "proj_123",
      session_id: "sess_456",
      parent_version_node_id: "vn_789"
    });
  });

  it("does not include parent_version_node_id when it is null", () => {
    const result = injectWorkbenchContext(baseParams, {
      projectId: "proj_123",
      sessionId: "sess_456",
      parentVersionNodeId: null
    });

    expect(result).toHaveProperty("project_id", "proj_123");
    expect(result).toHaveProperty("session_id", "sess_456");
    expect(result).not.toHaveProperty("parent_version_node_id");
  });

  it("returns params unchanged when context is null (no-context mode)", () => {
    const result = injectWorkbenchContext(baseParams, null);

    expect(result).toEqual(baseParams);
    expect(result).not.toHaveProperty("project_id");
    expect(result).not.toHaveProperty("session_id");
    expect(result).not.toHaveProperty("parent_version_node_id");
  });

  it("never sends board_* fields", () => {
    const result = injectWorkbenchContext(baseParams, fullContext);

    expect(result).not.toHaveProperty("board_document_id");
    expect(result).not.toHaveProperty("board_snapshot");
    expect(result).not.toHaveProperty("board_export_asset_id");
  });

  it("does not mutate the original params object", () => {
    const original = { ...baseParams };
    injectWorkbenchContext(baseParams, fullContext);

    expect(baseParams).toEqual(original);
  });
});

describe("appendWorkbenchContextToFormData (edit requests)", () => {
  it("appends context fields to FormData when context exists", () => {
    const fd = new FormData();
    fd.set("prompt", "test");
    appendWorkbenchContextToFormData(fd, fullContext);

    expect(fd.get("project_id")).toBe("proj_123");
    expect(fd.get("session_id")).toBe("sess_456");
    expect(fd.get("parent_version_node_id")).toBe("vn_789");
  });

  it("does not append parent_version_node_id when it is null", () => {
    const fd = new FormData();
    appendWorkbenchContextToFormData(fd, {
      projectId: "proj_123",
      sessionId: "sess_456",
      parentVersionNodeId: null
    });

    expect(fd.get("project_id")).toBe("proj_123");
    expect(fd.get("session_id")).toBe("sess_456");
    expect(fd.has("parent_version_node_id")).toBe(false);
  });

  it("leaves FormData unchanged when context is null (fallback mode)", () => {
    const fd = new FormData();
    fd.set("prompt", "test");
    appendWorkbenchContextToFormData(fd, null);

    expect(fd.has("project_id")).toBe(false);
    expect(fd.has("session_id")).toBe(false);
    expect(fd.has("parent_version_node_id")).toBe(false);
  });

  it("never sends board_* fields", () => {
    const fd = new FormData();
    appendWorkbenchContextToFormData(fd, fullContext);

    expect(fd.has("board_document_id")).toBe(false);
    expect(fd.has("board_snapshot")).toBe(false);
    expect(fd.has("board_export_asset_id")).toBe(false);
  });
});
