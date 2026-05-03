"use client";

import {
  formatVersionNodeTime,
  summarizeNodeParams,
  type CreatorVersionNode
} from "@/lib/creator/version-graph";

/**
 * Inspector 中"对话式版本流"小节：完整列出当前项目的版本节点，
 * 每个节点支持"回到版本 / 恢复参数 / 从此分叉"。当 forkParentId
 * 不为空时显示"分叉中" pill。
 *
 * 来自原 CreatorWorkspace.tsx L2275-2350（4116 行单文件巨兽拆分计划
 * 的第七刀）。地图"第二波" #13。当前实现保留原视觉与 className，
 * 后续 Phase 5/6 再统一视觉 token / 替换 raw className 为 shadcn variant。
 */
type VersionStreamSectionProps = {
  projectVersionNodes: CreatorVersionNode[];
  activeNodeId: string | null;
  forkParentId: string | null;
  onReturnToNode: (node: CreatorVersionNode) => void;
  onRestoreNodeParams: (node: CreatorVersionNode) => void;
  onStartFork: (node: CreatorVersionNode) => void;
};

export default function VersionStreamSection({
  projectVersionNodes,
  activeNodeId,
  forkParentId,
  onReturnToNode,
  onRestoreNodeParams,
  onStartFork
}: VersionStreamSectionProps) {
  return (
    <section
      aria-label="版本流"
      className="version-stream inspector-section"
      data-testid="version-stream"
    >
      <div className="version-stream-header">
        <div>
          <strong>对话式版本流</strong>
          <p>回溯参数，或从任意节点分叉生成。</p>
        </div>
        {forkParentId ? (
          <span className="version-context-pill">分叉中</span>
        ) : null}
      </div>
      {projectVersionNodes.length === 0 ? (
        <div className="version-empty">
          <strong>暂无版本节点</strong>
          <p>首次生成后会自动记录 prompt、参数和结果。</p>
        </div>
      ) : (
        <div className="version-node-list">
          {projectVersionNodes.map((node, index) => (
            <article
              className={`version-node ${
                node.id === activeNodeId ? "active" : ""
              }`}
              key={node.id}
            >
              <div className="version-node-meta">
                <span className="version-branch-badge">
                  {node.branchLabel}
                </span>
                <span>#{index + 1}</span>
                <span>{formatVersionNodeTime(node)}</span>
              </div>
              <strong>{node.source === "edit" ? "图生图" : "文生图"}</strong>
              <p>Prompt: {node.prompt}</p>
              <p>{summarizeNodeParams(node)}</p>
              {node.images.length > 0 ? (
                <div className="version-thumb-strip">
                  {node.images.slice(0, 4).map((image) => (
                    <img alt="" key={image.asset_id} src={image.url} />
                  ))}
                </div>
              ) : null}
              <div className="history-actions">
                <button
                  aria-label={`回到版本 ${node.prompt}`}
                  className="secondary-button"
                  onClick={() => onReturnToNode(node)}
                  type="button"
                >
                  回到版本
                </button>
                <button
                  aria-label={`版本流恢复参数 ${node.prompt}`}
                  className="secondary-button"
                  onClick={() => onRestoreNodeParams(node)}
                  type="button"
                >
                  恢复参数
                </button>
                <button
                  aria-label={`版本流从此分叉 ${node.prompt}`}
                  className="secondary-button"
                  onClick={() => onStartFork(node)}
                  type="button"
                >
                  从此分叉
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
