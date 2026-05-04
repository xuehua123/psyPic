"use client";

/**
 * SectionHeading —— Inspector / studio 区域内 section 标题统一组件。
 *
 * 用法：
 *   <SectionHeading icon={SlidersHorizontal} title="生成参数" />
 *   <SectionHeading
 *     icon={History}
 *     title="素材与历史"
 *     action={
 *       <button className="icon-button" type="button" onClick={...}>
 *         <RefreshCw size={16} aria-hidden="true" />
 *       </button>
 *     }
 *   />
 *
 * CSS：复用既有 `.section-heading` (app/globals.css L914)，仅做 JSX
 * 收敛 —— 把 ParamsSection / TemplatesSection / LibrarySection 等
 * 重复的 `<div className="section-heading"><Icon /><strong>...` 套路
 * 抽出，外加可选右侧 action（自动 `margin-left: auto` 由
 * `.section-heading .icon-button` CSS 处理）。
 *
 * 抽出于 UI 重构 Phase 5 第 2 刀（Phase 4 之后视觉打磨）。
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeadingProps {
  /** 左侧 lucide icon 组件，组件内固定 size=15 + aria-hidden。 */
  icon: LucideIcon;
  /** 标题文案，套 <strong> 包裹。 */
  title: string;
  /** 可选右侧操作（icon button / link 等），CSS 已 margin-left: auto。 */
  action?: ReactNode;
}

export default function SectionHeading({
  icon: Icon,
  title,
  action
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <Icon size={15} aria-hidden="true" />
      <strong>{title}</strong>
      {action}
    </div>
  );
}
