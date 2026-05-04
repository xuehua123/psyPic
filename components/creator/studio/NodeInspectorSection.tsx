"use client";

import {
  summarizeNodeParams,
  type CreatorVersionNode
} from "@/lib/creator/version-graph";

/**
 * Inspector 中"当前节点"小节：显示 activeVersionNode 的参数快照、
 * request-id、耗时。当无活跃节点时给出引导文案。
 *
 * 来自原 CreatorWorkspace.tsx L2381-2399（4116 行单文件巨兽拆分计划
 * 的第五刀）。地图"第一波叶子" #5。当前实现保留原视觉与 className，
 * 后续 Phase 5/6 再统一视觉 token。
 */
type NodeInspectorSectionProps = {
  activeVersionNode: CreatorVersionNode | null;
};

export default function NodeInspectorSection({
  activeVersionNode
}: NodeInspectorSectionProps) {
  return (
    <section
      aria-label="当前节点参数"
      className="node-inspector inspector-section"
      data-testid="node-inspector"
    >
      <div className="version-stream-header">
        <strong>Inspector</strong>
        <p>当前节点的参数快照。</p>
      </div>
      {activeVersionNode ? (
        <div className="inspector-stack">
          <p>{summarizeNodeParams(activeVersionNode)}</p>
          <p>{activeVersionNode.requestId ?? "暂无 request id"}</p>
          <p>{activeVersionNode.durationMs ?? 0}ms</p>
        </div>
      ) : (
        <p className="inline-hint">选择或生成一个版本后查看参数。</p>
      )}
    </section>
  );
}
