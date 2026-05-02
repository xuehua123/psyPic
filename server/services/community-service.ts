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

type PrismaCommunityInteractionRow = {
  id: string;
  workId: string;
  userId: string;
  createdAt: Date;
};

type PrismaCommunityWorkRow = {
  id: string;
  userId: string;
  taskId: string;
  assetId: string;
  visibility: CommunityWorkVisibility;
  reviewStatus: CommunityWorkReviewStatus;
  title: string;
  scene: string | null;
  tags: string[];
  promptSnapshot: string;
  paramsSnapshot: unknown;
  disclosePrompt: boolean;
  discloseParams: boolean;
  discloseReferenceImages: boolean;
  allowSameGeneration: boolean;
  allowReferenceReuse: boolean;
  publishedAt: Date | null;
  takenDownAt: Date | null;
  featuredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  likes?: PrismaCommunityInteractionRow[];
  favorites?: PrismaCommunityInteractionRow[];
};

type PrismaCommunityReportRow = {
  id: string;
  workId: string;
  reporterUserId: string;
  reason: string;
  details: string | null;
  status: CommunityReportStatus;
  reviewerUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  work?: PrismaCommunityWorkRow | null;
};

type PrismaCommunityClient = {
  user?: {
    upsert(input: {
      where: { id: string };
      create: { id: string };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  communityWork: {
    create(input: {
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaCommunityWorkRow>;
    findFirst(input: Record<string, unknown>): Promise<PrismaCommunityWorkRow | null>;
    findMany(input: Record<string, unknown>): Promise<PrismaCommunityWorkRow[]>;
    update(input: {
      where: { id: string };
      data: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<PrismaCommunityWorkRow>;
  };
  communityWorkLike: {
    upsert(input: Record<string, unknown>): Promise<unknown>;
    deleteMany(input: { where: { workId: string; userId: string } }): Promise<unknown>;
  };
  communityWorkFavorite: {
    upsert(input: Record<string, unknown>): Promise<unknown>;
    deleteMany(input: { where: { workId: string; userId: string } }): Promise<unknown>;
  };
  communityReport: {
    create(input: { data: Record<string, unknown> }): Promise<PrismaCommunityReportRow>;
    findMany(input: Record<string, unknown>): Promise<PrismaCommunityReportRow[]>;
    updateMany(input: Record<string, unknown>): Promise<unknown>;
  };
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
  var __psypicCommunityPrismaClient:
    | PrismaCommunityClient
    | null
    | undefined;
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

export async function createCommunityWorkForUser(
  userId: string,
  input: CreateCommunityWorkInput
) {
  const task = await getImageTaskForUser(input.taskId, userId);
  const asset = await getImageLibraryAssetForUser(userId, input.assetId);

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
  const databaseWork = await createDatabaseCommunityWork(work);

  return databaseWork ?? serializeCommunityWork(work);
}

export async function getCommunityWorkForViewer(
  workId: string,
  viewerUserId: string | null
) {
  const databaseLookup = await getDatabaseCommunityWorkRecordLookup(workId);
  if (databaseLookup.available) {
    if (!databaseLookup.work || !canViewCommunityWork(databaseLookup.work, viewerUserId)) {
      return null;
    }

    return serializeDatabaseCommunityWork(databaseLookup.work, viewerUserId);
  }

  const work = communityWorks.get(workId);

  if (!work || !canViewCommunityWork(work, viewerUserId)) {
    return null;
  }

  return serializeCommunityWork(work, { detail: true, viewerUserId });
}

export async function listPublicCommunityWorks(input?: {
  cursor?: string | null;
  limit?: number;
  scene?: string | null;
  tag?: string | null;
  sort?: string | null;
  viewerUserId?: string | null;
}) {
  const databaseWorks = await listDatabasePublicCommunityWorks(input);
  if (databaseWorks) {
    return databaseWorks;
  }

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

export async function setCommunityWorkInteractionForUser(
  userId: string,
  workId: string,
  input: {
    type: "like" | "favorite";
    enabled: boolean;
  }
) {
  const databaseResult = await setDatabaseCommunityWorkInteractionForUser(
    userId,
    workId,
    input
  );
  if (databaseResult.available) {
    return databaseResult.work;
  }

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

export async function createCommunitySameGenerationDraft(
  workId: string,
  viewerUserId: string | null
) {
  const work = await getCommunityWorkRecordForViewer(workId, viewerUserId);

  if (!work) {
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

export async function createCommunityReportForUser(
  userId: string,
  input: {
    workId: string;
    reason: string;
    details?: string | null;
  }
) {
  const work = await getCommunityWorkRecordForViewer(input.workId, userId);

  if (!work) {
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
  const databaseReport = await createDatabaseCommunityReport(report);

  return databaseReport ?? serializeCommunityReport(report);
}

export async function takeDownCommunityWork(
  workId: string,
  input: {
    reviewerUserId: string;
    reason?: string | null;
  }
) {
  const databaseWork = await updateDatabaseCommunityWorkModeration(workId, {
    reviewStatus: "taken_down",
    takenDownAt: new Date(),
    reviewerUserId: input.reviewerUserId
  });
  if (databaseWork) {
    return databaseWork;
  }

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

export async function restoreCommunityWork(
  workId: string,
  input: {
    reviewerUserId: string;
    reason?: string | null;
  }
) {
  const databaseWork = await updateDatabaseCommunityWorkModeration(workId, {
    reviewStatus: "approved",
    takenDownAt: null,
    reviewerUserId: input.reviewerUserId
  });
  if (databaseWork) {
    return databaseWork;
  }

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

export async function setCommunityWorkFeatured(
  workId: string,
  input: {
    reviewerUserId: string;
    featured: boolean;
  }
) {
  const databaseWork = await updateDatabaseCommunityWorkFeatured(
    workId,
    input.featured
  );
  if (databaseWork) {
    return databaseWork;
  }

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

export async function listCommunityReportsForAdmin(input?: {
  status?: CommunityReportStatus | "all" | null;
  cursor?: string | null;
  limit?: number;
}) {
  const databaseReports = await listDatabaseCommunityReportsForAdmin(input);
  if (databaseReports) {
    return databaseReports;
  }

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

async function getCommunityWorkRecordForViewer(
  workId: string,
  viewerUserId: string | null
) {
  const databaseLookup = await getDatabaseCommunityWorkRecordLookup(workId);
  if (databaseLookup.available) {
    if (!databaseLookup.work || !canViewCommunityWork(databaseLookup.work, viewerUserId)) {
      return null;
    }

    return databaseLookup.work;
  }

  const work = communityWorks.get(workId);

  if (!work || !canViewCommunityWork(work, viewerUserId)) {
    return null;
  }

  return work;
}

async function createDatabaseCommunityWork(work: CommunityWork) {
  const client = await getPrismaCommunityClient();
  if (!client) {
    return null;
  }

  try {
    await ensureDatabaseUser(client, work.user_id);
    const row = await client.communityWork.create({
      data: toPrismaCommunityWorkData(work),
      include: interactionInclude()
    });
    return serializePrismaCommunityWork(row);
  } catch {
    return null;
  }
}

async function getDatabaseCommunityWorkRecord(workId: string) {
  const lookup = await getDatabaseCommunityWorkRecordLookup(workId);

  return lookup.available ? lookup.work : null;
}

async function getDatabaseCommunityWorkRecordLookup(
  workId: string
): Promise<
  | { available: false }
  | { available: true; work: CommunityWork | null }
> {
  const client = await getPrismaCommunityClient();
  if (!client) {
    return { available: false };
  }

  try {
    const row = await client.communityWork.findFirst({
      where: { id: workId },
      include: interactionInclude()
    });
    return {
      available: true,
      work: row ? fromPrismaCommunityWork(row) : null
    };
  } catch {
    return { available: false };
  }
}

async function getDatabaseCommunityWorkForViewer(
  workId: string,
  viewerUserId: string | null
) {
  const work = await getDatabaseCommunityWorkRecord(workId);
  if (!work || !canViewCommunityWork(work, viewerUserId)) {
    return null;
  }

  return serializeDatabaseCommunityWork(work, viewerUserId);
}

async function listDatabasePublicCommunityWorks(input?: {
  cursor?: string | null;
  limit?: number;
  scene?: string | null;
  tag?: string | null;
  sort?: string | null;
  viewerUserId?: string | null;
}) {
  const client = await getPrismaCommunityClient();
  if (!client) {
    return null;
  }

  try {
    const limit = clampCommunityLimit(input?.limit);
    const scene = input?.scene?.trim();
    const tag = input?.tag?.trim();
    const sort = input?.sort?.trim();
    const works = (await client.communityWork.findMany({
      where: {
        visibility: "public",
        reviewStatus: "approved",
        takenDownAt: null
      },
      include: interactionInclude(),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200
    }))
      .map(fromPrismaCommunityWork)
      .filter((work) => (scene ? work.scene === scene : true))
      .filter((work) => (tag ? work.tags.includes(tag) : true))
      .sort((left, right) => compareDatabaseCommunityWorks(left, right, sort));
    const startIndex = input?.cursor
      ? works.findIndex((work) => work.id === input.cursor) + 1
      : 0;
    const safeStartIndex = Math.max(startIndex, 0);
    const page = works.slice(safeStartIndex, safeStartIndex + limit);
    const hasNextPage = works.length > safeStartIndex + page.length;

    return {
      items: page.map((work) =>
        serializeDatabaseCommunityWork(work, input?.viewerUserId ?? null)
      ),
      nextCursor: hasNextPage ? page.at(-1)?.id ?? null : null
    };
  } catch {
    return null;
  }
}

async function setDatabaseCommunityWorkInteractionForUser(
  userId: string,
  workId: string,
  input: { type: "like" | "favorite"; enabled: boolean }
): Promise<
  | { available: false }
  | { available: true; work: ReturnType<typeof serializeDatabaseCommunityWork> | null }
> {
  const client = await getPrismaCommunityClient();
  if (!client) {
    return { available: false };
  }

  try {
    const lookup = await getDatabaseCommunityWorkRecordLookup(workId);
    if (!lookup.available) {
      return { available: false };
    }

    const work = lookup.work;
    if (!work || !canViewCommunityWork(work, userId)) {
      return { available: true, work: null };
    }

    await ensureDatabaseUser(client, userId);
    const store =
      input.type === "like" ? client.communityWorkLike : client.communityWorkFavorite;
    if (input.enabled) {
      await store.upsert({
        where: { workId_userId: { workId, userId } },
        create: {
          id: createId(input.type === "like" ? "like" : "fav"),
          workId,
          userId,
          createdAt: new Date()
        },
        update: {}
      });
    } else {
      await store.deleteMany({ where: { workId, userId } });
    }

    return {
      available: true,
      work: await getDatabaseCommunityWorkForViewer(workId, userId)
    };
  } catch {
    return { available: false };
  }
}

async function createDatabaseCommunityReport(report: CommunityReport) {
  const client = await getPrismaCommunityClient();
  if (!client) {
    return null;
  }

  try {
    await ensureDatabaseUser(client, report.reporter_user_id);
    const row = await client.communityReport.create({
      data: {
        id: report.id,
        workId: report.work_id,
        reporterUserId: report.reporter_user_id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        reviewerUserId: report.reviewer_user_id,
        reviewedAt: report.reviewed_at ? new Date(report.reviewed_at) : null,
        createdAt: new Date(report.created_at),
        updatedAt: new Date(report.updated_at)
      }
    });
    return serializeCommunityReport(fromPrismaCommunityReport(row));
  } catch {
    return null;
  }
}

async function updateDatabaseCommunityWorkModeration(
  workId: string,
  input: {
    reviewStatus: CommunityWorkReviewStatus;
    takenDownAt: Date | null;
    reviewerUserId: string;
  }
) {
  const client = await getPrismaCommunityClient();
  if (!client) {
    return null;
  }

  try {
    if (input.reviewStatus === "taken_down") {
      await ensureDatabaseUser(client, input.reviewerUserId);
    }
    const row = await client.communityWork.update({
      where: { id: workId },
      data: {
        reviewStatus: input.reviewStatus,
        takenDownAt: input.takenDownAt,
        updatedAt: new Date()
      },
      include: interactionInclude()
    });
    if (input.reviewStatus === "taken_down") {
      await client.communityReport.updateMany({
        where: { workId, status: "open" },
        data: {
          status: "reviewed",
          reviewerUserId: input.reviewerUserId,
          reviewedAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    return serializePrismaCommunityWork(row);
  } catch {
    return null;
  }
}

async function updateDatabaseCommunityWorkFeatured(
  workId: string,
  featured: boolean
) {
  const client = await getPrismaCommunityClient();
  if (!client) {
    return null;
  }

  try {
    const current = await getDatabaseCommunityWorkRecord(workId);
    if (!current) {
      return null;
    }
    const row = await client.communityWork.update({
      where: { id: workId },
      data: {
        featuredAt: featured
          ? current.featured_at
            ? new Date(current.featured_at)
            : new Date()
          : null,
        updatedAt: new Date()
      },
      include: interactionInclude()
    });
    return serializePrismaCommunityWork(row);
  } catch {
    return null;
  }
}

async function listDatabaseCommunityReportsForAdmin(input?: {
  status?: CommunityReportStatus | "all" | null;
  cursor?: string | null;
  limit?: number;
}) {
  const client = await getPrismaCommunityClient();
  if (!client) {
    return null;
  }

  try {
    const limit = clampCommunityLimit(input?.limit);
    const status = input?.status ?? "open";
    const rows = await client.communityReport.findMany({
      where: status === "all" ? undefined : { status },
      include: { work: { include: interactionInclude() } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    const page = rows.slice(0, limit);

    return {
      items: page.map((row) => {
        const report = fromPrismaCommunityReport(row);
        return {
          ...serializeCommunityReport(report),
          reporter_user_id: report.reporter_user_id,
          reviewer_user_id: report.reviewer_user_id,
          reviewed_at: report.reviewed_at,
          work: row.work ? serializePrismaCommunityWork(row.work) : null
        };
      }),
      nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null
    };
  } catch {
    return null;
  }
}

async function ensureDatabaseUser(client: PrismaCommunityClient, userId: string) {
  if (!client.user) {
    return;
  }

  await client.user.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {}
  });
}

function serializePrismaCommunityWork(row: PrismaCommunityWorkRow) {
  return serializeDatabaseCommunityWork(fromPrismaCommunityWork(row), null);
}

function serializeDatabaseCommunityWork(
  work: CommunityWork,
  viewerUserId: string | null
) {
  const likes = getDatabaseInteractionSnapshot(communityLikes, work.id);
  const favorites = getDatabaseInteractionSnapshot(communityFavorites, work.id);

  return {
    ...serializeCommunityWork(work, { detail: true, viewerUserId: null }),
    like_count: likes.length,
    favorite_count: favorites.length,
    liked: viewerUserId
      ? likes.some((item) => item.user_id === viewerUserId)
      : false,
    favorited: viewerUserId
      ? favorites.some((item) => item.user_id === viewerUserId)
      : false
  };
}

function compareDatabaseCommunityWorks(
  left: CommunityWork,
  right: CommunityWork,
  sort: string | null | undefined
) {
  return compareCommunityWorks(left, right, sort);
}

function getDatabaseInteractionSnapshot(
  store: Map<string, CommunityInteraction>,
  workId: string
) {
  return Array.from(store.values()).filter((item) => item.work_id === workId);
}

function fromPrismaCommunityWork(row: PrismaCommunityWorkRow): CommunityWork {
  const work = {
    id: row.id,
    user_id: row.userId,
    task_id: row.taskId,
    asset_id: row.assetId,
    visibility: row.visibility,
    review_status: row.reviewStatus,
    title: row.title,
    scene: row.scene,
    tags: row.tags,
    image_url: readString(row, "imageUrl") ?? `/api/assets/${row.assetId}`,
    thumbnail_url:
      readString(row, "thumbnailUrl") ?? readString(row, "imageUrl") ?? `/api/assets/${row.assetId}`,
    prompt_snapshot: row.promptSnapshot,
    params_snapshot: isImageGenerationParams(row.paramsSnapshot)
      ? row.paramsSnapshot
      : imageParamsFallback(),
    disclose_prompt: row.disclosePrompt,
    disclose_params: row.discloseParams,
    disclose_reference_images: row.discloseReferenceImages,
    allow_same_generation: row.allowSameGeneration,
    allow_reference_reuse: row.allowReferenceReuse,
    published_at: row.publishedAt?.toISOString() ?? null,
    taken_down_at: row.takenDownAt?.toISOString() ?? null,
    featured_at: row.featuredAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  };

  communityWorks.set(work.id, work);
  syncInteractions(communityLikes, work.id, row.likes ?? []);
  syncInteractions(communityFavorites, work.id, row.favorites ?? []);

  return work;
}

function fromPrismaCommunityReport(row: PrismaCommunityReportRow): CommunityReport {
  const report = {
    id: row.id,
    work_id: row.workId,
    reporter_user_id: row.reporterUserId,
    reason: row.reason,
    details: row.details,
    status: row.status,
    reviewer_user_id: row.reviewerUserId,
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  };
  communityReports.set(report.id, report);
  if (row.work) {
    fromPrismaCommunityWork(row.work);
  }

  return report;
}

function syncInteractions(
  store: Map<string, CommunityInteraction>,
  workId: string,
  rows: PrismaCommunityInteractionRow[]
) {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(`${workId}:`)) {
      store.delete(key);
    }
  }

  for (const row of rows) {
    store.set(buildInteractionKey(row.workId, row.userId), {
      id: row.id,
      work_id: row.workId,
      user_id: row.userId,
      created_at: row.createdAt.toISOString()
    });
  }
}

function toPrismaCommunityWorkData(work: CommunityWork) {
  return {
    id: work.id,
    userId: work.user_id,
    taskId: work.task_id,
    assetId: work.asset_id,
    visibility: work.visibility,
    reviewStatus: work.review_status,
    title: work.title,
    scene: work.scene,
    tags: work.tags,
    promptSnapshot: work.prompt_snapshot,
    paramsSnapshot: work.params_snapshot,
    disclosePrompt: work.disclose_prompt,
    discloseParams: work.disclose_params,
    discloseReferenceImages: work.disclose_reference_images,
    allowSameGeneration: work.allow_same_generation,
    allowReferenceReuse: work.allow_reference_reuse,
    publishedAt: work.published_at ? new Date(work.published_at) : null,
    takenDownAt: work.taken_down_at ? new Date(work.taken_down_at) : null,
    featuredAt: work.featured_at ? new Date(work.featured_at) : null,
    createdAt: new Date(work.created_at),
    updatedAt: new Date(work.updated_at)
  };
}

function interactionInclude() {
  return { likes: true, favorites: true };
}

async function getPrismaCommunityClient() {
  if (!shouldUseDatabaseCommunityStore()) {
    return null;
  }

  if (globalThis.__psypicCommunityPrismaClient !== undefined) {
    return globalThis.__psypicCommunityPrismaClient;
  }

  try {
    const prismaClientPackage = "@prisma/client";
    const prismaModule = (await import(
      /* turbopackIgnore: true */ prismaClientPackage
    )) as {
      PrismaClient?: new () => PrismaCommunityClient;
    };

    globalThis.__psypicCommunityPrismaClient = prismaModule.PrismaClient
      ? new prismaModule.PrismaClient()
      : null;
  } catch {
    globalThis.__psypicCommunityPrismaClient = null;
  }

  return globalThis.__psypicCommunityPrismaClient;
}

function shouldUseDatabaseCommunityStore() {
  const mode = process.env.PSYPIC_COMMUNITY_STORE?.trim().toLowerCase();

  if (mode === "memory" || mode === "file") {
    return false;
  }

  return (
    mode === "database" ||
    mode === "db" ||
    (process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL))
  );
}

function readString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : undefined;
}

function isImageGenerationParams(value: unknown): value is ImageGenerationParams {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).prompt === "string"
  );
}

function imageParamsFallback(): ImageGenerationParams {
  return {
    prompt: "",
    model: "gpt-image-2",
    size: "1024x1024",
    quality: "medium",
    n: 1,
    output_format: "png",
    output_compression: null,
    background: "auto",
    moderation: "auto"
  };
}
