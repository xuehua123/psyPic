import { describe, expect, it } from "vitest";

import {
  injectWorkbenchContext,
  appendWorkbenchContextToFormData,
  type GenerationWorkbenchContext
} from "@/lib/creator/generation-context";
import type { BoardDocument } from "@/lib/creator/board/types";

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

// Cut 4.4 (plan slug 2026-05-20-board-mode-cut4-plan)：BoardCompositionRef
// 注入到 GenerationWorkbenchContext 后的最小形态。boardSnapshot 是一份完整
// 的 BoardDocument shape（带 13 个必填字段），避免 typecheck 报缺字段。
const boardSnapshot: BoardDocument = {
  id: "board-doc-cut44",
  version: 1,
  projectId: "proj_123",
  sessionId: "sess_456",
  title: "cut 4.4 board",
  width: 1280,
  height: 960,
  background: { type: "transparent" },
  layers: [
    {
      id: "layer-1",
      kind: "image",
      name: "ref-1",
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 0,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      assetId: "asset_cut44",
      src: "data:image/png;base64,iVBORw0KGgo=",
      width: 640,
      height: 480
    }
  ],
  activeLayerId: "layer-1",
  sourceVersionNodeIds: [],
  sourceAssetIds: [],
  createdAt: "2026-05-20T00:00:00.000Z",
  updatedAt: "2026-05-20T00:00:00.000Z",
  deletedAt: null
};

const boardContext: GenerationWorkbenchContext = {
  ...fullContext,
  boardDocumentId: "board-doc-cut44",
  boardExportAssetId: "board-export-1700000000000-abcd",
  boardSnapshot
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

  // Cut 4.4：context 不带 board 字段时（Cut 4.4 之前的常规调用方），输出
  // 完全不出现 board_* 字段——保住非 board submit 路径与 4.4 之前 byte-by-byte
  // 一致（plan §3 非破坏铁律）。
  it("omits board_* fields when context has no board metadata", () => {
    const result = injectWorkbenchContext(baseParams, fullContext);

    expect(result).not.toHaveProperty("board_document_id");
    expect(result).not.toHaveProperty("board_snapshot");
    expect(result).not.toHaveProperty("board_export_asset_id");
  });

  // Cut 4.4：context 带 board 字段时，三个字段 1:1 映射到 snake_case。
  // JSON body 路径直接放对象（后端把 body JSON.parse 后走 z.unknown 校验），
  // 不再额外 stringify。
  it("injects board_document_id / board_export_asset_id / board_snapshot when context provides them", () => {
    const result = injectWorkbenchContext(baseParams, boardContext);

    expect(result).toMatchObject({
      ...baseParams,
      project_id: "proj_123",
      session_id: "sess_456",
      parent_version_node_id: "vn_789",
      board_document_id: "board-doc-cut44",
      board_export_asset_id: "board-export-1700000000000-abcd"
    });
    expect(result).toHaveProperty("board_snapshot", boardSnapshot);
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

  // Cut 4.4：context 不带 board 字段时，FormData 完全不出现 board_*
  // 字段（plan §3 非破坏铁律）。普通 reference 提交保持原行为。
  it("omits board_* fields when context has no board metadata", () => {
    const fd = new FormData();
    appendWorkbenchContextToFormData(fd, fullContext);

    expect(fd.has("board_document_id")).toBe(false);
    expect(fd.has("board_snapshot")).toBe(false);
    expect(fd.has("board_export_asset_id")).toBe(false);
  });

  // Cut 4.4：context 带 board 字段时，FormData 写入三个 snake_case 键。
  // FormData 字段值只能是 string/Blob/File，所以 board_snapshot 走
  // JSON.stringify，后端 optionalJsonFromFormData 再 JSON.parse
  // (lib/validation/image-params.ts).
  it("appends board_document_id / board_export_asset_id and JSON.stringified board_snapshot when context provides them", () => {
    const fd = new FormData();
    appendWorkbenchContextToFormData(fd, boardContext);

    expect(fd.get("board_document_id")).toBe("board-doc-cut44");
    expect(fd.get("board_export_asset_id")).toBe(
      "board-export-1700000000000-abcd"
    );
    const snapshotRaw = fd.get("board_snapshot");
    expect(typeof snapshotRaw).toBe("string");
    expect(JSON.parse(String(snapshotRaw))).toEqual(boardSnapshot);
  });
});
