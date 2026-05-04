/**
 * CreatorWorkspace 共享类型。
 * 从原 components/creator/CreatorWorkspace.tsx 抽离，便于子组件、helper 模块共享。
 */

import type { ImageGenerationParams } from "@/lib/validation/image-params";

// 生成结果与图片
export type GenerationImage = {
  asset_id: string;
  url: string;
  format: string;
};

export type GenerationResult = {
  task_id: string;
  images: GenerationImage[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: string;
  };
  duration_ms: number;
  request_id: string;
  upstream_request_id?: string;
};

// API 响应封装
export type ApiGenerationResponse = {
  data?: Omit<GenerationResult, "request_id" | "upstream_request_id">;
  request_id?: string;
  upstream_request_id?: string;
  error?: {
    code: string;
    message: string;
    details?: { field?: string };
  };
};

// 创作模式与遮罩
export type CreatorMode = "text" | "image";
export type MaskMode = "paint" | "restore";

// 任务状态
export type ImageTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type CreatorTaskStatus = ImageTaskStatus | "submitting";

export type ImageTaskSnapshot = {
  id: string;
  type: "generation" | "edit";
  status: ImageTaskStatus;
  prompt: string;
  images: GenerationImage[];
  usage?: GenerationResult["usage"];
  upstream_request_id?: string;
  error?: {
    code: string;
    message?: string;
  };
  duration_ms?: number;
  updated_at?: string;
};

export type CurrentTask = Omit<Partial<ImageTaskSnapshot>, "status"> & {
  status: CreatorTaskStatus;
  type?: "generation" | "edit";
  prompt?: string;
};

export type ApiTaskResponse = {
  data?: ImageTaskSnapshot;
  request_id?: string;
  upstream_request_id?: string;
  error?: {
    code: string;
    message: string;
    details?: { field?: string };
  };
};

// 素材库
export type LibraryAssetItem = {
  asset_id: string;
  task_id: string;
  type: "generation" | "edit";
  prompt: string;
  params: ImageGenerationParams;
  url: string;
  thumbnail_url: string;
  format: string;
  usage?: GenerationResult["usage"];
  duration_ms?: number;
  created_at: string;
  favorite: boolean;
  tags: string[];
};

export type ApiLibraryResponse = {
  data?: {
    items: LibraryAssetItem[];
    next_cursor: string | null;
  };
  request_id?: string;
  error?: {
    code: string;
    message: string;
  };
};

export type ApiLibraryPatchResponse = {
  data?: LibraryAssetItem;
  request_id?: string;
  error?: {
    code: string;
    message: string;
  };
};

// Prompt assist
export type ApiPromptAssistResponse = {
  data?: {
    optimized_prompt: string;
    sections: string[];
    preservation_notes: string[];
  };
  request_id?: string;
  error?: {
    code: string;
    message: string;
    details?: { field?: string };
  };
};

// Community
export type ApiCommunityWorkResponse = {
  data?: {
    work_id: string;
  };
  request_id?: string;
  error?: {
    code: string;
    message: string;
    details?: { field?: string };
  };
};

export type ApiSameGenerationDraftResponse = {
  data?: {
    draft: {
      prompt: string;
      params?: Partial<ImageGenerationParams>;
      reference_asset_id?: string;
    };
  };
  request_id?: string;
  error?: {
    code: string;
    message: string;
  };
};

// Template field
export type TemplateFieldValue = string | boolean;
export type TemplateFieldValues = Record<string, TemplateFieldValue>;

// 项目与对话
//
// 4 个内置 ID 是 IndexedDB 首次进入的 default seed（commercial / social /
// campaign / same，见 lib/creator/projects.ts defaultProjectSeeds）；用户
// 新建的项目 ID 走 `proj_` 前缀（见 lib/creator/projects-store.ts
// createUserProjectId）。两者都是合法 CreatorProjectId。
export type CreatorProjectId =
  | "commercial"
  | "social"
  | "campaign"
  | "same"
  | `proj_${string}`;
export type CreatorConversationId = "all" | "new" | `branch:${string}`;

export type CreatorProjectMeta = {
  id: CreatorProjectId;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};
