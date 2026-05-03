"use client";

/**
 * Inspector —— 创作工作台右侧"参数 / 素材 / Inspector"容器壳。
 * 仅负责 aside + inspector-scroll 容器和 aria 标签，内部 4-5 个
 * section 通过 children 由父级编排，待后续逐个抽出（Phase 4 第
 * 15-19 刀）。
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx 原 L1569-2165 的
 * studio-inspector aside 外壳（UI 重构 Phase 4 第 14 刀）。
 *
 * Children pattern：section 内容继续 inline 在主壳，避免一次抽完
 * 600 行内部 section 时 transcript 累加爆炸；下一波第 15+ 刀按
 * section 逐个搬出。
 */

import type { ReactNode } from "react";

export default function Inspector({ children }: { children: ReactNode }) {
  return (
    <aside
      className="studio-inspector"
      data-testid="right-history-panel"
      aria-label="参数、素材与 Inspector"
    >
      <div className="inspector-scroll">{children}</div>
    </aside>
  );
}
