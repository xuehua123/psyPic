/**
 * Workbench generation context helper。
 *
 * 构建发给 /api/images/generations 和 /api/images/edits 的
 * workbench context 字段（project_id / session_id / parent_version_node_id）。
 *
 * 规则：
 *   - 仅在 context 存在时注入字段。
 *   - board_* 字段仅在 Board Mode composition context 存在时注入。
 *   - parent_version_node_id 仅在有可信 node id 时传递。
 */

import type { BoardDocument } from "./board/types";

export type GenerationWorkbenchContext = {
  projectId: string;
  sessionId: string;
  parentVersionNodeId?: string | null;
  boardDocumentId?: string;
  boardExportAssetId?: string;
  boardSnapshot?: BoardDocument;
};

/**
 * 给 generation JSON body 注入 workbench context。
 * 返回新对象，不修改原 params。
 */
export function injectWorkbenchContext<T extends Record<string, unknown>>(
  params: T,
  context: GenerationWorkbenchContext | null
): T {
  if (!context) {
    return params;
  }

  const result: Record<string, unknown> = { ...params };
  result.project_id = context.projectId;
  result.session_id = context.sessionId;

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
 */
export function appendWorkbenchContextToFormData(
  formData: FormData,
  context: GenerationWorkbenchContext | null
): FormData {
  if (!context) {
    return formData;
  }

  formData.set("project_id", context.projectId);
  formData.set("session_id", context.sessionId);

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
