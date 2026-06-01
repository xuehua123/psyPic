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

import { Copy, Download, ImagePlus, RotateCcw, X } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import {
  formatVersionNodeTime,
  summarizeNodeParams,
  type CreatorVersionNode
} from "@/lib/creator/version-graph";

const parseAspectRatio = (size?: string) => {
  if (!size) return "1/1";
  const [width, height] = size.split("x").map(Number);
  if (width && height) {
    return `${width}/${height}`;
  }
  return "1/1";
};

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

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // 监听 ESC 键关闭大图灯箱
  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage]);

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
              <Button
                variant="secondary"
                onClick={() => returnToVersionNode(node)}
                type="button"
                aria-label={`回到版本 ${node.prompt}`}
              >
                回到版本
              </Button>
              <Button
                variant="secondary"
                onClick={() => restoreVersionNodeParams(node)}
                type="button"
                aria-label={`恢复参数 ${node.prompt}`}
              >
                恢复参数
              </Button>
              <Button
                variant="secondary"
                onClick={() => startVersionFork(node)}
                type="button"
                aria-label={`从此分叉 ${node.prompt}`}
              >
                从此分叉
              </Button>
            </div>
          </div>
          {node.images.length > 0 ? (
            <div className="result-grid chat-result-grid">
              {node.images.map((image) => (
                <article className="result-card" key={image.asset_id}>
                  <div className="relative group overflow-hidden cursor-zoom-in">
                    <img 
                      alt="生成结果" 
                      src={image.url} 
                      onClick={() => setLightboxImage(image.url)}
                      style={{ aspectRatio: parseAspectRatio(node.params?.size) }}
                      className="w-full transition-transform duration-300 hover:scale-[1.02] block object-contain"
                    />
                  </div>
                  <div className="result-card-body">
                    <strong>{image.asset_id}</strong>
                    <p>{node.requestId}</p>
                    <p>{node.usage?.total_tokens ?? 0} tokens</p>
                    <div className="result-actions">
                      <Button asChild variant="secondary">
                        <a download href={image.url}>
                          <Download size={16} aria-hidden="true" />
                          下载
                        </a>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={copyPrompt}
                        type="button"
                      >
                        <Copy size={16} aria-hidden="true" />
                        复制 Prompt
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={submitGeneration}
                        type="button"
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        重试
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void handleResultAsReference(image)}
                        type="button"
                      >
                        <ImagePlus size={16} aria-hidden="true" />
                        作为参考图
                      </Button>
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

      {/* 全屏灯箱 Lightbox 预览模式 */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2 bg-white/10 hover:bg-white/20 rounded-full"
            type="button"
            aria-label="关闭预览"
          >
            <X size={20} />
          </button>
          <img
            alt="大图预览"
            src={lightboxImage}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
}
