"use client";

/**
 * Server-first VersionNode 加载 hook。
 *
 * 职责：
 *   1. 给定 sessionId，从 /api/workbench/version-nodes 拉取节点列表。
 *   2. 映射成 CreatorVersionNode[]，带上 branchId / depth / branchLabel。
 *   3. 失败时返回空数组，调用方 fallback 到本地 versionNodes。
 *
 * 不做：
 *   - 不做 Board Mode 映射（board_* 字段透传但不使用）。
 *   - 不做自动 sync / outbox。
 *   - 不做 Task Dock。
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { listVersionNodes as apiListVersionNodes } from "./workbench-api";
import { mapWorkbenchVersionNodeToCreatorNode } from "./workbench-mappers";
import type { CreatorVersionNode } from "./version-graph";
import type { WorkbenchVersionNode } from "./workbench-types";

export type UseVersionNodesReturn = {
  /** 映射后的 CreatorVersionNode[]（server session 不可用时为空数组） */
  nodes: CreatorVersionNode[];
  /** 加载状态 */
  isLoading: boolean;
  /** 用当前 sessionId 刷新 */
  refresh: () => Promise<void>;
  /**
   * 用指定 sessionId 刷新（绕过 hook 当前闭包中的 sessionId）。
   * 用于 ensureGenerationContext 刚创建 session 后立即刷新的场景。
   */
  refreshForSession: (sessionIdOverride: string) => Promise<void>;
};

/**
 * 从扁平列表重建 branch / depth 信息。
 *
 * 规则与 createVersionNode 一致：
 *   - parentId === null → 新 root（branchId = 自身 id）
 *   - 同 parent 的第一个 child 继承 parent branchId
 *   - 同 parent 的后续 child 新开分支（branchId = 自身 id）
 */
function rebuildBranchGraph(
  serverNodes: WorkbenchVersionNode[]
): CreatorVersionNode[] {
  // 按 created_at 排序确保从旧到新处理
  const sorted = [...serverNodes].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );

  const result: CreatorVersionNode[] = [];
  // 记录每个 parent 已有的 child 数量
  const childCountByParent = new Map<string, number>();
  // 记录已映射节点的信息（branchId / depth / branchLabel）
  const nodeInfo = new Map<
    string,
    { branchId: string; branchLabel: string; depth: number }
  >();

  let rootCount = 0;

  for (const node of sorted) {
    let branchId: string;
    let branchLabel: string;
    let depth: number;

    if (!node.parent_version_node_id) {
      // Root 节点
      branchId = node.id;
      branchLabel = rootCount === 0 ? "主线" : `对话 ${rootCount + 1}`;
      depth = 0;
      rootCount++;
    } else {
      const parentInfo = nodeInfo.get(node.parent_version_node_id);
      const parentDepth = parentInfo?.depth ?? 0;
      depth = parentDepth + 1;

      const siblingCount =
        childCountByParent.get(node.parent_version_node_id) ?? 0;

      if (siblingCount === 0) {
        // 第一个 child：继承 parent branch
        branchId = parentInfo?.branchId ?? node.id;
        branchLabel = parentInfo?.branchLabel ?? "主线";
      } else {
        // 后续 child：新开分支
        branchId = node.id;
        branchLabel = `分支 ${siblingCount + 1}`;
      }

      childCountByParent.set(
        node.parent_version_node_id,
        siblingCount + 1
      );
    }

    // 用 server 的 branch_label 覆盖（如果存在）
    if (node.branch_label) {
      branchLabel = node.branch_label;
    }

    nodeInfo.set(node.id, { branchId, branchLabel, depth });
    const mapped = mapWorkbenchVersionNodeToCreatorNode(node, depth, branchId);
    // 从 StoredWorkbenchVersionNode 剥离 board_*/workbench-only 字段，
    // 返回纯 CreatorVersionNode
    const {
      projectId: _pid,
      sessionId: _sid,
      boardDocumentId: _bd,
      boardSnapshot: _bs,
      boardExportAssetId: _bea,
      ...creatorNode
    } = mapped;
    creatorNode.branchLabel = branchLabel;
    result.push(creatorNode);
  }

  return result;
}

export function useVersionNodes(
  sessionId: string | null
): UseVersionNodesReturn {
  const [nodes, setNodes] = useState<CreatorVersionNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  // 内部加载函数，接受显式 sessionId
  const loadNodesForSession = useCallback(async (targetSessionId: string) => {
    setIsLoading(true);

    try {
      const result = await apiListVersionNodes(targetSessionId);

      if (!isMountedRef.current) return;

      if (result.success && Array.isArray(result.data?.items)) {
        setNodes(rebuildBranchGraph(result.data.items));
      } else {
        setNodes([]);
      }
    } catch {
      if (isMountedRef.current) {
        setNodes([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadNodes = useCallback(async () => {
    if (!sessionId) {
      setNodes([]);
      setIsLoading(false);
      return;
    }

    await loadNodesForSession(sessionId);
  }, [sessionId, loadNodesForSession]);

  // 显式 sessionId 覆盖：绕过当前闭包的 sessionId
  const refreshForSession = useCallback(
    async (sessionIdOverride: string) => {
      await loadNodesForSession(sessionIdOverride);
    },
    [loadNodesForSession]
  );

  useEffect(() => {
    isMountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNodes();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadNodes]);

  return { nodes, isLoading, refresh: loadNodes, refreshForSession };
}

// 导出供测试用
export { rebuildBranchGraph };
