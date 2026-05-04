import type { CreatorProjectId } from "@/lib/creator/types";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";

/**
 * 创作台的"项目"元数据。
 *
 * 历史：原本是 hardcoded 4 项 (commercial / social / campaign / same)
 * 静态 export，作为创作台一级菜单。
 *
 * 现状（项目 CRUD 接入后）：
 * - 4 项保留，作为首次进入的 default seed（写入 IndexedDB
 *   `psypic_projects` store）
 * - 用户可新建 / 重命名 / 删除项目（包括内置项目，符合"完整 CRUD"语义）
 * - emptyTitle / emptyDescription 仍由 seed 提供；用户自定义项目使用
 *   fallback 文案（见 lib/creator/use-projects.ts toMeta()）
 *
 * 真实数据流：
 *   IndexedDB StoredProject ─ useProjects() ─ toMeta() ─→ CreatorProjectMeta
 */
export type CreatorProjectMeta = {
  id: CreatorProjectId;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

/** 首次进入时写入 IndexedDB 的 default 项目种子。同时为 ChatEmptyState 提
 *  供文案 fallback（用户重命名或新建项目时仍可借用）。 */
export const defaultProjectSeeds: CreatorProjectMeta[] = [
  {
    id: "commercial",
    title: "商业图库项目",
    description: "默认项目 · 本地工作区",
    emptyTitle: "商业图片创作",
    emptyDescription: "准备第一张结果图。"
  },
  {
    id: "social",
    title: "社媒内容项目",
    description: "小红书、封面与信息流",
    emptyTitle: "社媒封面创作",
    emptyDescription: "为移动端内容流建立一条独立版本对话。"
  },
  {
    id: "campaign",
    title: "广告投放项目",
    description: "Banner、活动图与多尺寸批量",
    emptyTitle: "广告活动创作",
    emptyDescription: "把同一活动概念拆成横版、竖版和方图分支。"
  },
  {
    id: "same",
    title: "社区同款草稿",
    description: "同款生成与参考图",
    emptyTitle: "社区同款草稿",
    emptyDescription: "从社区作品或参考图开始一条新对话。"
  }
];

export type SidebarProjectBranchSummary = {
  id: string;
  label: string;
  count: number;
  latestNode: CreatorVersionNode | null;
  /** 用户重命名后的标题（覆盖 latestNode.prompt 显示）；来自 branch-meta-store。 */
  customLabel?: string;
  /** 置顶：sidebar 渲染时排到「置顶」桶。 */
  isPinned?: boolean;
  /** 归档：默认隐藏，「显示归档」toggle 后可见。 */
  isArchived?: boolean;
  /** derived: !lastReadAt || lastReadAt < latestNode.createdAt */
  hasUnread?: boolean;
};

export type SidebarProjectGroup = {
  project: CreatorProjectMeta;
  nodes: CreatorVersionNode[];
  branchSummaries: SidebarProjectBranchSummary[];
};
