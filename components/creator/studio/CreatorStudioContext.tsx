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

import { createContext, useContext, type ReactNode } from "react";

import type { GenerationImage } from "@/lib/creator/types";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";

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
