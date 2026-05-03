"use client";

import type { CSSProperties } from "react";

import type { CreatorVersionNode } from "@/lib/creator/version-graph";

/**
 * Inspector 中"分支图"小节：基于当前项目的版本节点列表展示一个紧凑
 * 树状视图，给 Board 模式做前置预览。当前节点高亮。
 *
 * 来自原 CreatorWorkspace.tsx L2351-2380（4116 行单文件巨兽拆分计划
 * 的第六刀）。地图"第二波" #6 起步。当前实现保留原视觉与 className，
 * 后续 Phase 5/6 再统一视觉 token。
 */
type BranchMapSectionProps = {
  projectVersionNodes: CreatorVersionNode[];
  activeNodeId: string | null;
};

export default function BranchMapSection({
  projectVersionNodes,
  activeNodeId
}: BranchMapSectionProps) {
  return (
    <section
      aria-label="分支图"
      className="branch-map inspector-section"
      data-testid="branch-map"
    >
      <div className="version-stream-header">
        <strong>分支图</strong>
        <p>Board 模式前置预览。</p>
      </div>
      {projectVersionNodes.length === 0 ? (
        <p className="inline-hint">生成后显示节点关系。</p>
      ) : (
        <div className="branch-node-list">
          {projectVersionNodes.map((node) => (
            <div
              className={`branch-node ${
                node.id === activeNodeId ? "active" : ""
              }`}
              data-depth={node.depth}
              key={node.id}
              style={{ "--node-depth": node.depth } as CSSProperties}
            >
              <span>{node.parentId ? "↳" : "●"}</span>
              <strong>路径：{node.branchLabel}</strong>
              <p>{node.prompt}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
