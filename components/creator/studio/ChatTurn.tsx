"use client";

/**
 * ChatTurn —— 创作对话流中的"一轮发言"，包含 user prompt 气泡 +
 * assistant 生成结果气泡（含 result grid 与 4 个交互按钮）。
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx 原 L1552-1661 的
 * displayedVersionNodes.map article 块（UI 重构 Phase 4 第 11 刀）。
 *
 * 数据来源:
 * - Props: node, index — 由父级 map 传入
 * - Context (useCreatorStudio): activeNodeId、returnToVersionNode、
 *   restoreVersionNodeParams、startVersionFork、copyPrompt、
 *   submitGeneration、handleResultAsReference
 * - 直接 import: formatVersionNodeTime / summarizeNodeParams（纯
 *   helper，从 lib/creator/version-graph）；4 个 lucide icon
 */

import { Copy, Download, ImagePlus, RotateCcw } from "lucide-react";

import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import {
  formatVersionNodeTime,
  summarizeNodeParams,
  type CreatorVersionNode
} from "@/lib/creator/version-graph";

export default function ChatTurn({
  node,
  index
}: {
  node: CreatorVersionNode;
  index: number;
}) {
  const {
    activeNodeId,
    returnToVersionNode,
    restoreVersionNodeParams,
    startVersionFork,
    submitGeneration,
    copyPrompt,
    handleResultAsReference
  } = useCreatorStudio();

  return (
    <article
      className={`chat-turn ${node.id === activeNodeId ? "active" : ""}`}
      data-testid={node.id === activeNodeId ? "active-gallery" : undefined}
    >
      <div className="chat-message user-message">
        <div className="chat-avatar">你</div>
        <div className="chat-bubble">
          <div className="chat-message-meta">
            <span>{node.branchLabel}</span>
            <span>#{index + 1}</span>
            <span>{formatVersionNodeTime(node)}</span>
          </div>
          <p>{node.prompt}</p>
        </div>
      </div>

      <div className="chat-message assistant-message">
        <div className="chat-avatar assistant-avatar">P</div>
        <div className="chat-bubble generation-bubble">
          <div className="generation-message-header">
            <div>
              <strong>
                {node.source === "edit" ? "图生图结果" : "文生图结果"}
              </strong>
              <p>{summarizeNodeParams(node)}</p>
            </div>
            <div className="history-actions">
              <button
                className="secondary-button"
                onClick={() => returnToVersionNode(node)}
                type="button"
                aria-label={`回到版本 ${node.prompt}`}
              >
                回到版本
              </button>
              <button
                className="secondary-button"
                onClick={() => restoreVersionNodeParams(node)}
                type="button"
                aria-label={`恢复参数 ${node.prompt}`}
              >
                恢复参数
              </button>
              <button
                className="secondary-button"
                onClick={() => startVersionFork(node)}
                type="button"
                aria-label={`从此分叉 ${node.prompt}`}
              >
                从此分叉
              </button>
            </div>
          </div>
          {node.images.length > 0 ? (
            <div className="result-grid chat-result-grid">
              {node.images.map((image) => (
                <article className="result-card" key={image.asset_id}>
                  <img alt="生成结果" src={image.url} />
                  <div className="result-card-body">
                    <strong>{image.asset_id}</strong>
                    <p>{node.requestId}</p>
                    <p>{node.usage?.total_tokens ?? 0} tokens</p>
                    <div className="result-actions">
                      <a
                        className="secondary-button"
                        download
                        href={image.url}
                      >
                        <Download size={16} aria-hidden="true" />
                        下载
                      </a>
                      <button
                        className="secondary-button"
                        onClick={copyPrompt}
                        type="button"
                      >
                        <Copy size={16} aria-hidden="true" />
                        复制 Prompt
                      </button>
                      <button
                        className="secondary-button"
                        onClick={submitGeneration}
                        type="button"
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        重试
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => void handleResultAsReference(image)}
                        type="button"
                      >
                        <ImagePlus size={16} aria-hidden="true" />
                        作为参考图
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="inline-hint">该节点暂无图片结果。</p>
          )}
        </div>
      </div>
    </article>
  );
}
