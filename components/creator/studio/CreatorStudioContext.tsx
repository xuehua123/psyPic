"use client";

/**
 * CreatorStudioContext
 *
 * 集中曝光散落在 CreatorWorkspace.tsx 主壳中的 state / handler，避免后续
 * 抽出的 studio/* 子组件长串 prop drilling。**按需扩展** —— 第一版只覆盖
 * 即将抽出的 ChatTurn 用到的 7 项；后续抽 Composer / Inspector / Library
 * 等组件时再按需补充字段，不要试图一次到位。
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx (UI 重构 Phase 4 第 10 刀)。
 *
 * 关联文档：docs/superpowers/plans/2026-05-03-creatorworkspace-extraction-map.md
 *
 * 设计权衡：
 * - 单 Context（不分多个）— 性能优化推迟到 React DevTools 出现明显
 *   wasted render 时再做。
 * - Provider value 由调用方自行决定是否 useMemo / useCallback；本文件
 *   不限制写法，给出最小契约即可。
 * - useCreatorStudio() 在没有 Provider 时抛错，避免 silent undefined。
 */

import {
  createContext,
  useContext,
  type ChangeEvent,
  type ClipboardEvent,
  type Dispatch,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction
} from "react";

import type {
  CreatorMode,
  GenerationImage,
  MaskMode
} from "@/lib/creator/types";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";
import type { ImageGenerationParams } from "@/lib/validation/image-params";

export type CreatorStudioContextValue = {
  // version graph 选择 / 操作
  activeNodeId: string | null;
  returnToVersionNode: (node: CreatorVersionNode) => void;
  restoreVersionNodeParams: (node: CreatorVersionNode) => void;
  startVersionFork: (node: CreatorVersionNode) => void;

  // 生成主流程 + 当次结果 → 参考图
  submitGeneration: () => Promise<void> | void;
  copyPrompt: () => Promise<void> | void;
  handleResultAsReference: (image: GenerationImage) => Promise<void> | void;

  // Composer 所需（第 13 刀-A 扩）：当前 prompt + 生成参数只读视图 +
  // composer-context-row 显示用，及优化 / 收藏两个辅助 handler
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  mode: CreatorMode;
  size: ImageGenerationParams["size"];
  quality: ImageGenerationParams["quality"];
  outputFormat: ImageGenerationParams["output_format"];
  n: number;
  streamEnabled: boolean;
  forkParentId: string | null;
  errorMessage: string;
  isAssistingPrompt: boolean;
  isGenerating: boolean;
  optimizePrompt: () => Promise<void> | void;
  saveCurrentPromptFavorite: () => Promise<void> | void;

  // ParamsSection 所需（第 15 刀-A 扩）：6 个 setter for Composer 已读
  // 字段 + advanced/moderation 等 4 个 read+write + 商业尺寸预设
  setMode: Dispatch<SetStateAction<CreatorMode>>;
  setSize: Dispatch<SetStateAction<ImageGenerationParams["size"]>>;
  setQuality: Dispatch<SetStateAction<ImageGenerationParams["quality"]>>;
  setOutputFormat: Dispatch<
    SetStateAction<ImageGenerationParams["output_format"]>
  >;
  setN: Dispatch<SetStateAction<number>>;
  setStreamEnabled: Dispatch<SetStateAction<boolean>>;
  partialImageCount: number;
  setPartialImageCount: Dispatch<SetStateAction<number>>;
  advancedOpen: boolean;
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  outputCompression: string;
  setOutputCompression: Dispatch<SetStateAction<string>>;
  moderation: ImageGenerationParams["moderation"];
  setModeration: Dispatch<SetStateAction<ImageGenerationParams["moderation"]>>;
  selectedCommercialSizeId: string;
  selectCommercialSize: (presetId: string) => void;

  // ReferenceSection / MaskEditor 所需（第 16 刀扩）：参考图列表 + 4 个
  // input handler + mask 状态 + canvas ref + 6 个 stroke handler
  referenceImages: File[];
  referencePreviews: { name: string; url: string }[];
  referenceImage: File | null;
  handleReferenceInput: (event: ChangeEvent<HTMLInputElement>) => void;
  handleReferenceDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleReferencePaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  removeReferenceImage: (index: number) => void;
  maskEnabled: boolean;
  setMaskEnabled: Dispatch<SetStateAction<boolean>>;
  maskMode: MaskMode;
  setMaskMode: Dispatch<SetStateAction<MaskMode>>;
  maskBrushSize: number;
  setMaskBrushSize: Dispatch<SetStateAction<number>>;
  maskCanvasRef: RefObject<HTMLCanvasElement | null>;
  resetMaskCanvas: () => void;
  invertMaskCanvas: () => void;
  startMaskStroke: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  continueMaskStroke: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  stopMaskStroke: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
};

const CreatorStudioContext = createContext<CreatorStudioContextValue | null>(
  null
);

export function CreatorStudioProvider({
  children,
  value
}: {
  children: ReactNode;
  value: CreatorStudioContextValue;
}) {
  return (
    <CreatorStudioContext.Provider value={value}>
      {children}
    </CreatorStudioContext.Provider>
  );
}

export function useCreatorStudio(): CreatorStudioContextValue {
  const context = useContext(CreatorStudioContext);
  if (context === null) {
    throw new Error(
      "useCreatorStudio 必须在 <CreatorStudioProvider> 内使用。"
    );
  }
  return context;
}
