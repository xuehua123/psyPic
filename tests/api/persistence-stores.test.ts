import { describe, expect, it } from "vitest";
import type { ImageGenerationParams } from "@/lib/validation/image-params";
import {
  createCommunityReportForUser,
  createCommunityWorkForUser,
  getCommunityWorkForViewer,
  listCommunityReportsForAdmin,
  resetCommunityInteractionStore,
  resetCommunityReportStore,
  resetCommunityWorkStore,
  setCommunityWorkInteractionForUser
} from "@/server/services/community-service";
import {
  createImageAlbumForUser,
  createImageTask,
  getImageLibraryAssetForUser,
  listImageAlbumsForUser,
  listImageTaskHistoryForUser,
  markImageTaskSucceeded,
  resetImageAlbumStore,
  resetImageLibraryStore,
  resetImageTaskStore,
  updateImageLibraryAssetForUser
} from "@/server/services/image-task-service";

const params: ImageGenerationParams = {
  prompt: "Create a persisted product image.",
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "medium",
  n: 1,
  output_format: "png",
  output_compression: null,
  background: "auto",
  moderation: "auto"
};

describe("database-backed production stores", () => {
  it("reloads image tasks, library metadata and albums from the database store", async () => {
    resetImageTaskStore();
    resetImageLibraryStore();
    resetImageAlbumStore();
    const previousStore = process.env.PSYPIC_IMAGE_TASK_STORE;
    process.env.PSYPIC_IMAGE_TASK_STORE = "database";
    const prismaClient = createImageTaskPrismaDouble({ enforceUsers: true });
    (globalThis as unknown as Record<string, unknown>).__psypicImageTaskPrismaClient =
      prismaClient;

    try {
      const task = await createImageTask({
        userId: "user_db_images",
        keyBindingId: "kb_db_images",
        type: "generation",
        prompt: params.prompt,
        params
      });
      await markImageTaskSucceeded(task.id, {
        images: [
          {
            asset_id: "asset_db_images_1",
            url: "/api/assets/asset_db_images_1",
            width: 1024,
            height: 1024,
            format: "png"
          }
        ],
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          total_tokens: 3,
          estimated_cost: "0.0001"
        },
        durationMs: 123,
        upstreamRequestId: "upstream_db_images"
      });
      await updateImageLibraryAssetForUser("user_db_images", "asset_db_images_1", {
        favorite: true,
        tags: ["电商主图"]
      });
      await createImageAlbumForUser("user_db_images", {
        title: "DB 相册",
        assetIds: ["asset_db_images_1"]
      });

      resetImageTaskStore();
      resetImageLibraryStore();
      resetImageAlbumStore();

      const history = await listImageTaskHistoryForUser("user_db_images", {
        limit: 10
      });
      const asset = await getImageLibraryAssetForUser(
        "user_db_images",
        "asset_db_images_1"
      );
      const albums = await listImageAlbumsForUser("user_db_images");

      expect(history.items[0]?.id).toBe(task.id);
      expect(asset).toMatchObject({
        asset_id: "asset_db_images_1",
        favorite: true,
        tags: ["电商主图"]
      });
      expect(albums[0]).toMatchObject({
        title: "DB 相册",
        asset_ids: ["asset_db_images_1"]
      });
    } finally {
      resetImageTaskStore();
      resetImageLibraryStore();
      resetImageAlbumStore();
      delete (globalThis as unknown as Record<string, unknown>)
        .__psypicImageTaskPrismaClient;
      restoreEnv("PSYPIC_IMAGE_TASK_STORE", previousStore);
    }
  });

  it("reloads community works, interactions and reports from the database store", async () => {
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    resetCommunityInteractionStore();
    resetCommunityReportStore();
    const previousStore = process.env.PSYPIC_COMMUNITY_STORE;
    process.env.PSYPIC_COMMUNITY_STORE = "database";
    const prismaClient = createCommunityPrismaDouble({ enforceUsers: true });
    (globalThis as unknown as Record<string, unknown>).__psypicCommunityPrismaClient =
      prismaClient;

    try {
      const task = await createImageTask({
        userId: "user_db_community_owner",
        keyBindingId: "kb_db_community",
        type: "generation",
        prompt: params.prompt,
        params
      });
      await markImageTaskSucceeded(task.id, {
        images: [
          {
            asset_id: "asset_db_community_1",
            url: "/api/assets/asset_db_community_1",
            width: 1024,
            height: 1024,
            format: "png"
          }
        ],
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          total_tokens: 3,
          estimated_cost: "0.0001"
        },
        durationMs: 123
      });
      const work = await createCommunityWorkForUser(
        "user_db_community_owner",
        {
          taskId: task.id,
          assetId: "asset_db_community_1",
          visibility: "public",
          title: "DB 社区作品",
          scene: "ecommerce",
          tags: ["社区"],
          disclosePrompt: false,
          discloseParams: false,
          discloseReferenceImages: false,
          allowSameGeneration: true,
          allowReferenceReuse: false
        }
      );
      if (!work) {
        throw new Error("expected community work");
      }
      await setCommunityWorkInteractionForUser("user_db_viewer", work.work_id, {
        type: "like",
        enabled: true
      });
      await setCommunityWorkInteractionForUser("user_db_viewer", work.work_id, {
        type: "favorite",
        enabled: true
      });
      await createCommunityReportForUser("user_db_viewer", {
        workId: work.work_id,
        reason: "unsafe",
        details: "需要审核"
      });

      resetCommunityWorkStore();
      resetCommunityInteractionStore();
      resetCommunityReportStore();

      const detail = await getCommunityWorkForViewer(
        work.work_id,
        "user_db_viewer"
      );
      const reports = await listCommunityReportsForAdmin({ status: "open" });

      expect(detail).toMatchObject({
        work_id: work.work_id,
        like_count: 1,
        favorite_count: 1,
        liked: true,
        favorited: true
      });
      expect(reports.items[0]).toMatchObject({
        work_id: work.work_id,
        reason: "unsafe"
      });
    } finally {
      resetImageTaskStore();
      resetImageLibraryStore();
      resetCommunityWorkStore();
      resetCommunityInteractionStore();
      resetCommunityReportStore();
      delete (globalThis as unknown as Record<string, unknown>)
        .__psypicCommunityPrismaClient;
      restoreEnv("PSYPIC_COMMUNITY_STORE", previousStore);
    }
  });

  it("does not leak stale in-memory community rows when the database row is hidden", async () => {
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    resetCommunityInteractionStore();
    resetCommunityReportStore();
    const previousStore = process.env.PSYPIC_COMMUNITY_STORE;
    process.env.PSYPIC_COMMUNITY_STORE = "database";
    const prismaClient = createCommunityPrismaDouble({ enforceUsers: true });
    (globalThis as unknown as Record<string, unknown>).__psypicCommunityPrismaClient =
      prismaClient;

    try {
      const task = await createImageTask({
        userId: "user_db_stale_owner",
        keyBindingId: "kb_db_stale",
        type: "generation",
        prompt: params.prompt,
        params
      });
      await markImageTaskSucceeded(task.id, {
        images: [
          {
            asset_id: "asset_db_stale_1",
            url: "/api/assets/asset_db_stale_1",
            width: 1024,
            height: 1024,
            format: "png"
          }
        ],
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          total_tokens: 3,
          estimated_cost: "0.0001"
        },
        durationMs: 123
      });
      const work = await createCommunityWorkForUser("user_db_stale_owner", {
        taskId: task.id,
        assetId: "asset_db_stale_1",
        visibility: "public",
        title: "旧内存快照作品",
        scene: "ecommerce",
        tags: ["社区"],
        disclosePrompt: false,
        discloseParams: false,
        discloseReferenceImages: false,
        allowSameGeneration: true,
        allowReferenceReuse: false
      });
      if (!work) {
        throw new Error("expected community work");
      }

      await prismaClient.communityWork.update({
        where: { id: work.work_id },
        data: {
          reviewStatus: "taken_down",
          takenDownAt: new Date("2026-05-02T01:00:00.000Z")
        }
      });

      await expect(getCommunityWorkForViewer(work.work_id, null)).resolves.toBeNull();
    } finally {
      resetImageTaskStore();
      resetImageLibraryStore();
      resetCommunityWorkStore();
      resetCommunityInteractionStore();
      resetCommunityReportStore();
      delete (globalThis as unknown as Record<string, unknown>)
        .__psypicCommunityPrismaClient;
      restoreEnv("PSYPIC_COMMUNITY_STORE", previousStore);
    }
  });

  it("does not leak stale database interaction snapshots after unlike or unfavorite", async () => {
    resetImageTaskStore();
    resetImageLibraryStore();
    resetCommunityWorkStore();
    resetCommunityInteractionStore();
    resetCommunityReportStore();
    const previousStore = process.env.PSYPIC_COMMUNITY_STORE;
    process.env.PSYPIC_COMMUNITY_STORE = "database";
    const prismaClient = createCommunityPrismaDouble({ enforceUsers: true });
    (globalThis as unknown as Record<string, unknown>).__psypicCommunityPrismaClient =
      prismaClient;

    try {
      const task = await createImageTask({
        userId: "user_db_interaction_owner",
        keyBindingId: "kb_db_interaction",
        type: "generation",
        prompt: params.prompt,
        params
      });
      await markImageTaskSucceeded(task.id, {
        images: [
          {
            asset_id: "asset_db_interaction_1",
            url: "/api/assets/asset_db_interaction_1",
            width: 1024,
            height: 1024,
            format: "png"
          }
        ],
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          total_tokens: 3,
          estimated_cost: "0.0001"
        },
        durationMs: 123
      });
      const work = await createCommunityWorkForUser(
        "user_db_interaction_owner",
        {
          taskId: task.id,
          assetId: "asset_db_interaction_1",
          visibility: "public",
          title: "DB 互动作品",
          scene: "ecommerce",
          tags: ["社区"],
          disclosePrompt: false,
          discloseParams: false,
          discloseReferenceImages: false,
          allowSameGeneration: true,
          allowReferenceReuse: false
        }
      );
      if (!work) {
        throw new Error("expected community work");
      }
      await setCommunityWorkInteractionForUser(
        "user_db_interaction_viewer",
        work.work_id,
        {
          type: "like",
          enabled: true
        }
      );
      await setCommunityWorkInteractionForUser(
        "user_db_interaction_viewer",
        work.work_id,
        {
          type: "favorite",
          enabled: true
        }
      );

      await setCommunityWorkInteractionForUser(
        "user_db_interaction_viewer",
        work.work_id,
        {
          type: "like",
          enabled: false
        }
      );
      await setCommunityWorkInteractionForUser(
        "user_db_interaction_viewer",
        work.work_id,
        {
          type: "favorite",
          enabled: false
        }
      );

      const detail = await getCommunityWorkForViewer(
        work.work_id,
        "user_db_interaction_viewer"
      );

      expect(detail).toMatchObject({
        work_id: work.work_id,
        like_count: 0,
        favorite_count: 0,
        liked: false,
        favorited: false
      });
    } finally {
      resetImageTaskStore();
      resetImageLibraryStore();
      resetCommunityWorkStore();
      resetCommunityInteractionStore();
      resetCommunityReportStore();
      delete (globalThis as unknown as Record<string, unknown>)
        .__psypicCommunityPrismaClient;
      restoreEnv("PSYPIC_COMMUNITY_STORE", previousStore);
    }
  });
});

function createImageTaskPrismaDouble(input?: { enforceUsers?: boolean }) {
  const users = new Set<string>();
  const tasks = new Map<string, Record<string, unknown>>();
  const assets = new Map<string, Record<string, unknown>>();
  const tags = new Map<string, Array<{ name: string }>>();
  const albums = new Map<string, Record<string, unknown>>();
  const requireUser = (userId: unknown) => {
    if (input?.enforceUsers && !users.has(String(userId))) {
      throw new Error(`missing user ${String(userId)}`);
    }
  };

  return {
    user: {
      upsert: async ({
        where,
        create
      }: {
        where: { id: string };
        create: { id: string };
      }) => {
        users.add(where.id ?? create.id);
        return { id: where.id ?? create.id };
      }
    },
    imageTask: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        requireUser(data.userId);
        const row = withDates(data);
        tasks.set(String(row.id), row);
        return row;
      },
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = tasks.get(where.id) ?? {};
        const row = withDates({ ...current, ...data, id: where.id });
        tasks.set(where.id, row);
        return row;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = Array.from(tasks.values()).find(
          (item) =>
            item.id === where.id &&
            (where.userId === undefined || item.userId === where.userId)
        );
        return row ? withTaskAssets(row, assets, tags) : null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        Array.from(tasks.values())
          .filter(
            (item) =>
              (where.userId === undefined || item.userId === where.userId) &&
              (where.status === undefined || item.status === where.status)
          )
          .map((item) => withTaskAssets(item, assets, tags))
    },
    imageAsset: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        for (const item of data) {
          requireUser(item.userId);
          assets.set(String(item.id), withDates(item));
        }
        return { count: data.length };
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = Array.from(assets.values()).find(
          (item) =>
            item.id === where.id &&
            (where.userId === undefined || item.userId === where.userId)
        );
        return row ? withAssetRelations(row, tasks, tags) : null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        Array.from(assets.values())
          .filter((item) => where.userId === undefined || item.userId === where.userId)
          .map((item) => withAssetRelations(item, tasks, tags)),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: { favorite?: boolean };
      }) => {
        const current = assets.get(where.id) ?? {};
        const row = withDates({ ...current, ...data, id: where.id });
        assets.set(where.id, row);
        return withAssetRelations(row, tasks, tags);
      }
    },
    imageAssetTag: {
      deleteMany: async ({ where }: { where: { assetId: string } }) => {
        tags.set(where.assetId, []);
        return { count: 0 };
      },
      createMany: async ({
        data
      }: {
        data: Array<{ assetId: string; name: string }>;
      }) => {
        for (const item of data) {
          tags.set(item.assetId, [
            ...(tags.get(item.assetId) ?? []),
            { name: item.name }
          ]);
        }
        return { count: data.length };
      }
    },
    album: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        requireUser(data.userId);
        const row = withDates(data);
        albums.set(String(row.id), row);
        return withAlbumItems(row);
      },
      findMany: async ({ where }: { where: { userId: string } }) =>
        Array.from(albums.values())
          .filter((item) => item.userId === where.userId)
          .map(withAlbumItems)
    }
  };
}

function createCommunityPrismaDouble(input?: { enforceUsers?: boolean }) {
  const users = new Set<string>();
  const works = new Map<string, Record<string, unknown>>();
  const likes = new Map<string, Record<string, unknown>>();
  const favorites = new Map<string, Record<string, unknown>>();
  const reports = new Map<string, Record<string, unknown>>();
  const requireUser = (userId: unknown) => {
    if (input?.enforceUsers && !users.has(String(userId))) {
      throw new Error(`missing user ${String(userId)}`);
    }
  };

  return {
    user: {
      upsert: async ({
        where,
        create
      }: {
        where: { id: string };
        create: { id: string };
      }) => {
        users.add(where.id ?? create.id);
        return { id: where.id ?? create.id };
      }
    },
    communityWork: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        requireUser(data.userId);
        const row = withDates(data);
        works.set(String(row.id), row);
        return withCommunityRelations(row, likes, favorites);
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = Array.from(works.values()).find(
          (item) =>
            (where.id === undefined || item.id === where.id) &&
            (where.visibility === undefined || item.visibility === where.visibility)
        );
        return row ? withCommunityRelations(row, likes, favorites) : null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        Array.from(works.values())
          .filter(
            (item) =>
              (where.visibility === undefined || item.visibility === where.visibility) &&
              (where.reviewStatus === undefined ||
                item.reviewStatus === where.reviewStatus)
          )
          .map((item) => withCommunityRelations(item, likes, favorites)),
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = withDates({ ...(works.get(where.id) ?? {}), ...data, id: where.id });
        works.set(where.id, row);
        return withCommunityRelations(row, likes, favorites);
      }
    },
    communityWorkLike: {
      upsert: async ({ where, create }: { where: { workId_userId: { workId: string; userId: string } }; create: Record<string, unknown> }) => {
        requireUser(create.userId);
        likes.set(`${where.workId_userId.workId}:${where.workId_userId.userId}`, withDates(create));
      },
      deleteMany: async ({ where }: { where: { workId: string; userId: string } }) => {
        likes.delete(`${where.workId}:${where.userId}`);
      }
    },
    communityWorkFavorite: {
      upsert: async ({ where, create }: { where: { workId_userId: { workId: string; userId: string } }; create: Record<string, unknown> }) => {
        requireUser(create.userId);
        favorites.set(`${where.workId_userId.workId}:${where.workId_userId.userId}`, withDates(create));
      },
      deleteMany: async ({ where }: { where: { workId: string; userId: string } }) => {
        favorites.delete(`${where.workId}:${where.userId}`);
      }
    },
    communityReport: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        requireUser(data.reporterUserId);
        const row = withDates(data);
        reports.set(String(row.id), row);
        return row;
      },
      updateMany: async () => ({ count: 0 }),
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        Array.from(reports.values())
          .filter((item) => where.status === undefined || item.status === where.status)
          .map((item) => ({
            ...item,
            work: works.get(String(item.workId)) ?? null
          }))
    }
  };
}

function withDates(
  data: Record<string, unknown>
): Record<string, unknown> & { createdAt: Date; updatedAt: Date } {
  return {
    ...data,
    createdAt:
      data.createdAt instanceof Date
        ? data.createdAt
        : new Date("2026-05-02T00:00:00.000Z"),
    updatedAt:
      data.updatedAt instanceof Date
        ? data.updatedAt
        : new Date("2026-05-02T00:00:00.000Z")
  };
}

function withTaskAssets(
  task: Record<string, unknown>,
  assets: Map<string, Record<string, unknown>>,
  tags: Map<string, Array<{ name: string }>>
) {
  return {
    ...task,
    assets: Array.from(assets.values())
      .filter((asset) => asset.taskId === task.id)
      .map((asset) => ({ ...asset, tags: tags.get(String(asset.id)) ?? [] }))
  };
}

function withAssetRelations(
  asset: Record<string, unknown>,
  tasks: Map<string, Record<string, unknown>>,
  tags: Map<string, Array<{ name: string }>>
) {
  return {
    ...asset,
    task: tasks.get(String(asset.taskId)) ?? null,
    tags: tags.get(String(asset.id)) ?? []
  };
}

function withAlbumItems(album: Record<string, unknown>) {
  const itemInput =
    album.items &&
    typeof album.items === "object" &&
    !Array.isArray(album.items) &&
    Array.isArray((album.items as Record<string, unknown>).create)
      ? ((album.items as Record<string, unknown>).create as Array<{
          assetId: string;
          sortOrder: number;
        }>)
      : [];

  return {
    ...album,
    items: itemInput.map((item) => ({
      assetId: item.assetId,
      sortOrder: item.sortOrder
    }))
  };
}

function withCommunityRelations(
  work: Record<string, unknown>,
  likes: Map<string, Record<string, unknown>>,
  favorites: Map<string, Record<string, unknown>>
) {
  return {
    ...work,
    likes: Array.from(likes.values()).filter((item) => item.workId === work.id),
    favorites: Array.from(favorites.values()).filter(
      (item) => item.workId === work.id
    )
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
