import type { CreatorProjectId } from "@/lib/creator/types";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";

/**
 * 创作台的"项目"元数据：固定 4 项预设（商业 / 社媒 / 广告 / 社区同款），
 * 在 ProjectSidebar 与若干派生 useMemo 中共享。
 */
export type CreatorProjectMeta = {
  id: CreatorProjectId;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

export const creatorProjects: CreatorProjectMeta[] = [
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
};

export type SidebarProjectGroup = {
  project: CreatorProjectMeta;
  nodes: CreatorVersionNode[];
  branchSummaries: SidebarProjectBranchSummary[];
};
