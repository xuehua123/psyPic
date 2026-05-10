/**
 * 确保 generation/edit 请求的 workbench context 可用。
 *
 * 职责：
 *   1. 非 server 模式 → 返回 null，走旧路径。
 *   2. server 模式但 activeProjectId 不在 rawServerProjects 里 → 返回 null。
 *   3. 找到 project 但无 active_session_id → createSession + updateProject → 刷新 workbench → 返回 context。
 *   4. 有 active_session_id → 直接返回 context。
 *   5. parentVersionNodeId 只在该 id 存在于 serverNodeIds 集合中时才包含。
 *
 * 不做：Board Mode / Task Dock / offline sync。
 */

import {
  createSession as apiCreateSession,
  updateProject as apiUpdateProject
} from "./workbench-api";
import type { GenerationWorkbenchContext } from "./generation-context";
import type { WorkbenchProject } from "./workbench-types";

export type EnsureContextInput = {
  /** 当前 workbench 模式 */
  mode: string;
  /** 原始 server projects */
  rawServerProjects: WorkbenchProject[];
  /** 当前激活的 project id */
  activeProjectId: string;
  /** 当前可信 parent node id（来自 forkParentId / activeNodeId，新对话时为 null） */
  candidateParentNodeId: string | null;
  /** 当前 server version node id 集合 */
  serverNodeIds: Set<string>;
  /** 刷新 workbench projects（创建 session 后需要同步） */
  refreshWorkbench: () => Promise<void>;
};

/**
 * 解析或创建 generation workbench context。
 * 返回 null 表示 fallback/本地模式。
 */
export async function ensureGenerationContext(
  input: EnsureContextInput
): Promise<GenerationWorkbenchContext | null> {
  if (input.mode !== "server") {
    return null;
  }

  const rawProject = input.rawServerProjects.find(
    (p) => p.id === input.activeProjectId
  );
  if (!rawProject) {
    return null;
  }

  let sessionId = rawProject.active_session_id;

  // 如果 project 没有 active_session_id，创建一个
  if (!sessionId) {
    const sessionResult = await apiCreateSession({
      project_id: rawProject.id,
      title: "默认会话"
    });

    if (!sessionResult.success) {
      return null;
    }

    sessionId = sessionResult.data.id;

    // 更新 project 的 active_session_id
    await apiUpdateProject(rawProject.id, {
      active_session_id: sessionId
    });

    // 刷新 workbench 以同步最新 project 状态
    await input.refreshWorkbench();
  }

  // parentVersionNodeId 只在存在于 server nodes 时才发送
  const parentVersionNodeId =
    input.candidateParentNodeId &&
    input.serverNodeIds.has(input.candidateParentNodeId)
      ? input.candidateParentNodeId
      : null;

  return {
    projectId: rawProject.id,
    sessionId,
    parentVersionNodeId
  };
}
