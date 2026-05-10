/**
 * Workbench generation context helper。
 *
 * 构建发给 /api/images/generations 和 /api/images/edits 的
 * workbench context 字段（project_id / session_id / parent_version_node_id）。
 *
 * 规则：
 *   - 仅在 context 存在时注入字段。
 *   - 不发送 board_* 字段（Board Mode 仍不开发）。
 *   - parent_version_node_id 仅在有可信 node id 时传递。
 */

export type GenerationWorkbenchContext = {
  projectId: string;
  sessionId: string;
  parentVersionNodeId?: string | null;
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

  // 显式不发送 board_* 字段
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

  // 显式不发送 board_* 字段
  return formData;
}
