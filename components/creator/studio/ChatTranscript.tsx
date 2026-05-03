"use client";

/**
 * ChatTranscript —— 创作工作台中部"对话流"容器，负责编排：
 * - 空态 ChatEmptyState（无版本节点时）
 * - 版本节点列表 ChatTurn.map（一轮一组消息）
 * - TaskStatusStrip（当前任务状态条）
 * - PartialPreviewStrip（流式过程图条）
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx 原 L1542-1567 的
 * chat-transcript div（UI 重构 Phase 4 第 12 刀）。
 *
 * 设计权衡：
 * - 子组件 ChatTurn 走 useCreatorStudio() 自取 7 字段，本组件无需
 *   感知。
 * - currentTask / isGenerating / partialImages + 3 个 task handler
 *   暂时通过 prop 传 —— 是否补进 Context 等第 13 刀（Composer）
 *   再决定（避免单刀扩 Context 太多字段）。
 */

import ChatEmptyState from "@/components/creator/studio/ChatEmptyState";
import ChatTurn from "@/components/creator/studio/ChatTurn";
import PartialPreviewStrip from "@/components/creator/studio/PartialPreviewStrip";
import TaskStatusStrip from "@/components/creator/studio/TaskStatusStrip";

import type { CurrentTask, GenerationImage } from "@/lib/creator/types";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";

export default function ChatTranscript({
  currentTask,
  displayedVersionNodes,
  emptyDescription,
  emptyTitle,
  isGenerating,
  onCancelTask,
  onRefreshTask,
  onRetryGeneration,
  partialImages
}: {
  currentTask: CurrentTask | null;
  displayedVersionNodes: CreatorVersionNode[];
  emptyDescription: string;
  emptyTitle: string;
  isGenerating: boolean;
  onCancelTask: () => void;
  onRefreshTask: (taskId: string) => void;
  onRetryGeneration: () => void;
  partialImages: GenerationImage[];
}) {
  return (
    <div
      className="chat-transcript"
      data-testid="chat-transcript"
      aria-label="创作对话流"
    >
      {displayedVersionNodes.length === 0 ? (
        <ChatEmptyState
          emptyDescription={emptyDescription}
          emptyTitle={emptyTitle}
        />
      ) : (
        displayedVersionNodes.map((node, index) => (
          <ChatTurn key={node.id} index={index} node={node} />
        ))
      )}

      <TaskStatusStrip
        currentTask={currentTask}
        isGenerating={isGenerating}
        onCancelTask={onCancelTask}
        onRefreshTask={onRefreshTask}
        onRetryGeneration={onRetryGeneration}
      />

      <PartialPreviewStrip partialImages={partialImages} />
    </div>
  );
}
