import type { ImageGenerationParams } from "@/lib/validation/image-params";
import { createId } from "@/server/services/key-binding-service";
import {
  getImageLibraryAssetForUser,
  getImageTaskForUser
} from "@/server/services/image-task-service";

export type CommunityWorkVisibility = "private" | "unlisted" | "public";
export type CommunityWorkReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "taken_down";
export type CommunityReportStatus = "open" | "reviewed" | "dismissed";

type CommunityWork = {
  id: string;
  user_id: string;
  task_id: string;
  asset_id: string;
  visibility: CommunityWorkVisibility;
  review_status: CommunityWorkReviewStatus;
  title: string;
  scene: string | null;
  tags: string[];
  image_url: string;
  thumbnail_url: string;
  prompt_snapshot: string;
  params_snapshot: ImageGenerationParams;
  disclose_prompt: boolean;
  disclose_params: boolean;
  disclose_reference_images: boolean;
  allow_same_generation: boolean;
  allow_reference_reuse: boolean;
  published_at: string | null;
  taken_down_at: string | null;
  featured_at: string | null;
  created_at: string;
  updated_at: string;
};

type CommunityReport = {
  id: string;
  work_id: string;
  reporter_user_id: string;
  reason: string;
  details: string | null;
  status: CommunityReportStatus;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CommunityInteraction = {
  id: string;
  work_id: string;
  user_id: string;
  created_at: string;
};

export type CreateCommunityWorkInput = {
  taskId: string;
  assetId: string;
  visibility: CommunityWorkVisibility;
  title: string;
  scene: string | null;
  tags: string[];
  disclosePrompt: boolean;
  discloseParams: boolean;
  discloseReferenceImages: boolean;
  allowSameGeneration: boolean;
  allowReferenceReuse: boolean;
};

declare global {
  var __psypicCommunityWorks: Map<string, CommunityWork> | undefined;
  var __psypicCommunityReports: Map<string, CommunityReport> | undefined;
  var __psypicCommunityLikes: Map<string, CommunityInteraction> | undefined;
  var __psypicCommunityFavorites: Map<string, CommunityInteraction> | undefined;
}

const communityWorks =
  globalThis.__psypicCommunityWorks ?? new Map<string, CommunityWork>();
globalThis.__psypicCommunityWorks = communityWorks;
const communityReports =
  globalThis.__psypicCommunityReports ?? new Map<string, CommunityReport>();
globalThis.__psypicCommunityReports = communityReports;
const communityLikes =
  globalThis.__psypicCommunityLikes ?? new Map<string, CommunityInteraction>();
globalThis.__psypicCommunityLikes = communityLikes;
const communityFavorites =
  globalThis.__psypicCommunityFavorites ?? new Map<string, CommunityInteraction>();
globalThis.__psypicCommunityFavorites = communityFavorites;

export function resetCommunityWorkStore() {
  communityWorks.clear();
  resetCommunityInteractionStore();
}

export function resetCommunityReportStore() {
  communityReports.clear();
}

export function resetCommunityInteractionStore() {
  communityLikes.clear();
  communityFavorites.clear();
}

export function createCommunityWorkForUser(
  userId: string,
  input: CreateCommunityWorkInput
) {
  const task = getImageTaskForUser(input.taskId, userId);
  const asset = getImageLibraryAssetForUser(userId, input.assetId);

  if (!task || !asset || asset.task_id !== task.id) {
    return null;
  }

  const now = new Date().toISOString();
  const work: CommunityWork = {
    id: createId("work"),
    user_id: userId,
    task_id: task.id,
    asset_id: asset.asset_id,
    visibility: input.visibility,
    review_status: "approved",
    title: input.title,
    scene: input.scene,
    tags: normalizeTags(input.tags),
    image_url: asset.url,
    thumbnail_url: asset.thumbnail_url,
    prompt_snapshot: task.prompt,
    params_snapshot: task.params,
    disclose_prompt: input.disclosePrompt,
    disclose_params: input.discloseParams,
    disclose_reference_images: input.discloseReferenceImages,
    allow_same_generation: input.allowSameGeneration,
    allow_reference_reuse: input.allowReferenceReuse,
    published_at: input.visibility === "private" ? null : now,
    taken_down_at: null,
    featured_at: null,
    created_at: now,
    updated_at: now
  };

  communityWorks.set(work.id, work);
  return serializeCommunityWork(work);
}

export function getCommunityWorkForViewer(
  workId: string,
  viewerUserId: string | null
) {
  const work = communityWorks.get(workId);

  if (!work || !canViewCommunityWork(work, viewerUserId)) {
    return null;
  }

  return serializeCommunityWork(work, { detail: true, viewerUserId });
}

export function listPublicCommunityWorks(input?: {
  cursor?: string | null;
  limit?: number;
  scene?: string | null;
  tag?: string | null;
  sort?: string | null;
  viewerUserId?: string | null;
}) {
  const limit = clampCommunityLimit(input?.limit);
  const scene = input?.scene?.trim();
  const tag = input?.tag?.trim();
  const sort = input?.sort?.trim();
  const works = Array.from(communityWorks.values())
    .filter(
      (work) =>
        work.visibility === "public" &&
        work.review_status === "approved" &&
        !work.taken_down_at
    )
    .filter((work) => (scene ? work.scene === scene : true))
    .filter((work) => (tag ? work.tags.includes(tag) : true))
    .sort((left, right) => compareCommunityWorks(left, right, sort));
  const startIndex = input?.cursor
    ? works.findIndex((work) => work.id === input.cursor) + 1
    : 0;
  const safeStartIndex = Math.max(startIndex, 0);
  const page = works.slice(safeStartIndex, safeStartIndex + limit);
  const hasNextPage = works.length > safeStartIndex + page.length;

  return {
    items: page.map((work) =>
      serializeCommunityWork(work, { viewerUserId: input?.viewerUserId ?? null })
    ),
    nextCursor: hasNextPage ? page.at(-1)?.id ?? null : null
  };
}

export function setCommunityWorkInteractionForUser(
  userId: string,
  workId: string,
  input: {
    type: "like" | "favorite";
    enabled: boolean;
  }
) {
  const work = communityWorks.get(workId);

  if (!work || !canViewCommunityWork(work, userId)) {
    return null;
  }

  const store = input.type === "like" ? communityLikes : communityFavorites;
  const key = buildInteractionKey(workId, userId);

  if (input.enabled && !store.has(key)) {
    store.set(key, {
      id: createId(input.type === "like" ? "like" : "fav"),
      work_id: workId,
      user_id: userId,
      created_at: new Date().toISOString()
    });
  }

  if (!input.enabled) {
    store.delete(key);
  }

  return serializeCommunityWork(work, {
    detail: true,
    viewerUserId: userId
  });
}

export function createCommunitySameGenerationDraft(
  workId: string,
  viewerUserId: string | null
) {
  const work = communityWorks.get(workId);

  if (!work || !canViewCommunityWork(work, viewerUserId)) {
    return { status: "not_found" as const };
  }

  if (!work.allow_same_generation) {
    return { status: "disabled" as const };
  }

  const draft = {
    prompt: work.disclose_prompt
      ? work.prompt_snapshot
      : buildPrivatePromptFallback(work),
    params: work.disclose_params
      ? work.params_snapshot
      : buildPublicParamsFallback(work.params_snapshot),
    ...(work.disclose_reference_images && work.allow_reference_reuse
      ? { reference_asset_id: work.asset_id }
      : {})
  };

  return {
    status: "ok" as const,
    draft
  };
}

export function createCommunityReportForUser(
  userId: string,
  input: {
    workId: string;
    reason: string;
    details?: string | null;
  }
) {
  const work = communityWorks.get(input.workId);

  if (!work || !canViewCommunityWork(work, userId)) {
    return null;
  }

  const now = new Date().toISOString();
  const report: CommunityReport = {
    id: createId("report"),
    work_id: work.id,
    reporter_user_id: userId,
    reason: input.reason,
    details: input.details?.trim() ? input.details.trim().slice(0, 500) : null,
    status: "open",
    reviewer_user_id: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now
  };

  communityReports.set(report.id, report);
  return serializeCommunityReport(report);
}

export function takeDownCommunityWork(
  workId: string,
  input: {
    reviewerUserId: string;
    reason?: string | null;
  }
) {
  const work = communityWorks.get(workId);

  if (!work) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: CommunityWork = {
    ...work,
    review_status: "taken_down",
    taken_down_at: now,
    updated_at: now
  };

  communityWorks.set(work.id, updated);

  for (const report of communityReports.values()) {
    if (report.work_id === work.id && report.status === "open") {
      communityReports.set(report.id, {
        ...report,
        status: "reviewed",
        reviewer_user_id: input.reviewerUserId,
        reviewed_at: now,
        updated_at: now
      });
    }
  }

  return serializeCommunityWork(updated, { detail: true });
}

export function restoreCommunityWork(
  workId: string,
  input: {
    reviewerUserId: string;
    reason?: string | null;
  }
) {
  const work = communityWorks.get(workId);

  if (!work) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: CommunityWork = {
    ...work,
    review_status: "approved",
    taken_down_at: null,
    updated_at: now
  };

  communityWorks.set(work.id, updated);
  void input;

  return serializeCommunityWork(updated, { detail: true });
}

export function setCommunityWorkFeatured(
  workId: string,
  input: {
    reviewerUserId: string;
    featured: boolean;
  }
) {
  const work = communityWorks.get(workId);

  if (!work) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: CommunityWork = {
    ...work,
    featured_at: input.featured ? work.featured_at ?? now : null,
    updated_at: now
  };

  communityWorks.set(work.id, updated);

  return serializeCommunityWork(updated, { detail: true });
}

export function listCommunityReportsForAdmin(input?: {
  status?: CommunityReportStatus | "all" | null;
  cursor?: string | null;
  limit?: number;
}) {
  const limit = clampCommunityLimit(input?.limit);
  const status = input?.status ?? "open";
  const reports = Array.from(communityReports.values())
    .filter((report) => (status === "all" ? true : report.status === status))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const startIndex = input?.cursor
    ? reports.findIndex((report) => report.id === input.cursor) + 1
    : 0;
  const safeStartIndex = Math.max(startIndex, 0);
  const page = reports.slice(safeStartIndex, safeStartIndex + limit);
  const hasNextPage = reports.length > safeStartIndex + page.length;

  return {
    items: page.map((report) => {
      const work = communityWorks.get(report.work_id);

      return {
        ...serializeCommunityReport(report),
        reporter_user_id: report.reporter_user_id,
        reviewer_user_id: report.reviewer_user_id,
        reviewed_at: report.reviewed_at,
        work: work ? serializeCommunityWork(work) : null
      };
    }),
    nextCursor: hasNextPage ? page.at(-1)?.id ?? null : null
  };
}

function serializeCommunityWork(
  work: CommunityWork,
  options?: { detail?: boolean; viewerUserId?: string | null }
) {
  const viewerUserId = options?.viewerUserId ?? null;

  return {
    work_id: work.id,
    task_id: work.task_id,
    asset_id: work.asset_id,
    visibility: work.visibility,
    review_status: work.review_status,
    title: work.title,
    scene: work.scene,
    tags: work.tags,
    image_url: work.image_url,
    thumbnail_url: work.thumbnail_url,
    disclose_prompt: work.disclose_prompt,
    disclose_params: work.disclose_params,
    disclose_reference_images: work.disclose_reference_images,
    allow_same_generation: work.allow_same_generation,
    allow_reference_reuse: work.allow_reference_reuse,
    same_generation_available: work.allow_same_generation,
    published_at: work.published_at,
    taken_down_at: work.taken_down_at,
    featured_at: work.featured_at,
    featured: Boolean(work.featured_at),
    like_count: countInteractionsForWork(communityLikes, work.id),
    favorite_count: countInteractionsForWork(communityFavorites, work.id),
    liked: viewerUserId
      ? communityLikes.has(buildInteractionKey(work.id, viewerUserId))
      : false,
    favorited: viewerUserId
      ? communityFavorites.has(buildInteractionKey(work.id, viewerUserId))
      : false,
    created_at: work.created_at,
    updated_at: work.updated_at,
    ...(options?.detail && work.disclose_prompt
      ? { prompt: work.prompt_snapshot }
      : {}),
    ...(options?.detail && work.disclose_params
      ? { params: work.params_snapshot }
      : {}),
    ...(options?.detail && work.disclose_reference_images
      ? { reference_images: [] }
      : {})
  };
}

function compareCommunityWorks(
  left: CommunityWork,
  right: CommunityWork,
  sort: string | null | undefined
) {
  if (sort === "featured") {
    const featuredCompare =
      (right.featured_at ?? "").localeCompare(left.featured_at ?? "");

    if (featuredCompare !== 0) {
      return featuredCompare;
    }
  }

  if (sort === "popular") {
    const rightScore =
      countInteractionsForWork(communityLikes, right.id) * 2 +
      countInteractionsForWork(communityFavorites, right.id);
    const leftScore =
      countInteractionsForWork(communityLikes, left.id) * 2 +
      countInteractionsForWork(communityFavorites, left.id);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
  }

  return right.created_at.localeCompare(left.created_at);
}

function countInteractionsForWork(
  store: Map<string, CommunityInteraction>,
  workId: string
) {
  return Array.from(store.values()).filter((item) => item.work_id === workId)
    .length;
}

function buildInteractionKey(workId: string, userId: string) {
  return `${workId}:${userId}`;
}

function serializeCommunityReport(report: CommunityReport) {
  return {
    report_id: report.id,
    work_id: report.work_id,
    reason: report.reason,
    details: report.details,
    status: report.status,
    created_at: report.created_at,
    updated_at: report.updated_at
  };
}

function canViewCommunityWork(
  work: CommunityWork,
  viewerUserId: string | null
) {
  if (work.taken_down_at || work.review_status === "taken_down") {
    return false;
  }

  if (work.visibility === "private") {
    return work.user_id === viewerUserId;
  }

  return true;
}

function buildPrivatePromptFallback(work: CommunityWork) {
  const tags = work.tags.length > 0 ? `，参考标签：${work.tags.join("、")}` : "";

  return `按作品《${work.title}》的公开场景生成相似商业图片${tags}。保持高质量商业摄影风格，不复刻未公开 Prompt、品牌标识或私有参考图。`;
}

function buildPublicParamsFallback(params: ImageGenerationParams) {
  return {
    prompt: "",
    model: params.model,
    size: params.size,
    quality: params.quality,
    n: 1,
    output_format: params.output_format,
    output_compression: params.output_compression,
    background: params.background,
    moderation: params.moderation
  };
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().replace(/\s+/g, " ").slice(0, 24))
        .filter((tag) => tag.length > 0)
    )
  ).slice(0, 12);
}

function clampCommunityLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    return 30;
  }

  return Math.min(Math.max(limit, 1), 50);
}
