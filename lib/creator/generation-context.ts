import type { BoardDocument } from "./board/types";

/**
 * Workbench generation context helper。
 *
 * 构建发给 /api/images/generations 和 /api/images/edits 的
 * workbench context 字段：
 *   - 基础：project_id / session_id / parent_version_node_id
 *   - Board Mode（Cut 4.4 起，plan slug 2026-05-20-board-mode-cut4-plan）：
 *     board_document_id / board_export_asset_id / board_snapshot
 *
 * 规则：
 *   - 仅在 context 存在对应字段时才注入；没传就完全不出现，**保证非 board
 *     submit 路径与 Cut 4.4 之前的请求 byte-by-byte 一致**（plan 2026-05-12
 *     第 4 节非破坏铁律 + Cut 4.4 plan §3）。
 *   - parent_version_node_id 仅在有可信 node id 时传递。
 *   - board_snapshot 是 JSON.stringify(BoardDocument)，后端
 *     parseImageWorkbenchContext 走 z.unknown().optional() + 内部 JSON.parse
 *     校验（lib/validation/image-params.ts）。
 *   - board_export_asset_id 在 Cut 4 仍是 client temp id（格式
 *     `board-export-${ts}-${rand4}`），后端只透传，不与 Asset 表挂钩；Cut 5
 *     升级为持久化 asset id。
 */

export type GenerationWorkbenchContext = {
  /**
   * Server workbench project id；只在 mode === "server" 且能解析到 project
   * 时存在。fallback / 本地模式下整段 context 仍可能存在（仅为带 board_*
   * 字段而构造的 partial context），此时 projectId 为 undefined，helper
   * 不会写入 project_id / session_id。
   */
  projectId?: string;
  /** Server session id；与 projectId 同生共死。 */
  sessionId?: string;
  parentVersionNodeId?: string | null;
  /** Cut 4.4：BoardCompositionRef.boardDocumentId 透传。 */
  boardDocumentId?: string;
  /** Cut 4.4：BoardCompositionRef.boardExportAssetId 透传。Cut 4 仍是 client temp id。 */
  boardExportAssetId?: string;
  /** Cut 4.4：BoardCompositionRef.boardSnapshot 原对象，FormData 路径 helper 内部 JSON.stringify。 */
  boardSnapshot?: BoardDocument;
};

/**
 * 给 generation JSON body 注入 workbench context。
 * 返回新对象，不修改原 params。
 *
 * Board 字段：board_snapshot 在 JSON body 路径里以原对象形式塞进去
 * （后端把 body JSON.parse 后直接 z.unknown 校验），不再额外 stringify。
 * 但目前 Composer 提交链路里只有 FormData 分支会带 board context（image
 * mode + reference 存在），JSON body 路径（纯 generation / streaming）不带
 * board context；这里仍然支持，是给未来调用方留口子。
 */
export function injectWorkbenchContext<T extends Record<string, unknown>>(
  params: T,
  context: GenerationWorkbenchContext | null
): T {
  if (!context) {
    return params;
  }

  const result: Record<string, unknown> = { ...params };

  if (context.projectId) {
    result.project_id = context.projectId;
  }

  if (context.sessionId) {
    result.session_id = context.sessionId;
  }

  if (context.parentVersionNodeId) {
    result.parent_version_node_id = context.parentVersionNodeId;
  }

  if (context.boardDocumentId) {
    result.board_document_id = context.boardDocumentId;
  }

  if (context.boardExportAssetId) {
    result.board_export_asset_id = context.boardExportAssetId;
  }

  if (context.boardSnapshot) {
    result.board_snapshot = context.boardSnapshot;
  }

  return result as T;
}

/**
 * 给 edit FormData 追加 workbench context。
 * 原地修改 formData 并返回。
 *
 * board_snapshot 走 JSON.stringify —— FormData 字段值只能是 string / Blob /
 * File，后端 optionalJsonFromFormData 拿到后再 JSON.parse。
 */
export function appendWorkbenchContextToFormData(
  formData: FormData,
  context: GenerationWorkbenchContext | null
): FormData {
  if (!context) {
    return formData;
  }

  if (context.projectId) {
    formData.set("project_id", context.projectId);
  }

  if (context.sessionId) {
    formData.set("session_id", context.sessionId);
  }

  if (context.parentVersionNodeId) {
    formData.set("parent_version_node_id", context.parentVersionNodeId);
  }

  if (context.boardDocumentId) {
    formData.set("board_document_id", context.boardDocumentId);
  }

  if (context.boardExportAssetId) {
    formData.set("board_export_asset_id", context.boardExportAssetId);
  }

  if (context.boardSnapshot) {
    formData.set("board_snapshot", JSON.stringify(context.boardSnapshot));
  }

  return formData;
}
