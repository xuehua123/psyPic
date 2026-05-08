import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Prisma v0.2 data model", () => {
  it("defines the foundation models required by the MVP plan", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    for (const model of ["User", "Session", "KeyBinding", "AuditLog"]) {
      expect(schema).toContain(`model ${model}`);
    }

    expect(schema).toContain("sub2apiApiKeyCiphertext");
    expect(schema).toContain("requestId");
  });

  it("defines the v0.7 library models for persistent assets and albums", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    for (const model of [
      "ImageTask",
      "ImageAsset",
      "ImageAssetTag",
      "Album",
      "AlbumItem"
    ]) {
      expect(schema).toContain(`model ${model}`);
    }

    expect(schema).toContain("favorite");
    expect(schema).toContain("@@unique([assetId, name])");
    expect(schema).toContain("@@unique([albumId, assetId])");
  });

  it("defines the v0.9 community work models and privacy controls", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    expect(schema).toContain("enum CommunityWorkVisibility");
    expect(schema).toContain("private");
    expect(schema).toContain("unlisted");
    expect(schema).toContain("public");
    expect(schema).toContain("enum CommunityWorkReviewStatus");
    expect(schema).toContain("model CommunityWork");
    expect(schema).toContain("disclosePrompt");
    expect(schema).toContain("discloseParams");
    expect(schema).toContain("discloseReferenceImages");
    expect(schema).toContain("allowSameGeneration");
    expect(schema).toContain("allowReferenceReuse");
    expect(schema).toContain("@@index([visibility, reviewStatus, createdAt])");
  });

  it("defines the v0.9 community report moderation model", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    expect(schema).toContain("enum CommunityReportStatus");
    expect(schema).toContain("model CommunityReport");
    expect(schema).toContain("reporterUserId");
    expect(schema).toContain("reviewerUserId");
    expect(schema).toContain("@@index([workId, status])");
  });

  it("defines V1 admin settings, audit and community interaction persistence", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    expect(schema).toContain("model RuntimeSetting");
    expect(schema).toContain("updatedByUserId");
    expect(schema).toContain("featuredAt");
    expect(schema).toContain("model CommunityWorkLike");
    expect(schema).toContain("model CommunityWorkFavorite");
    expect(schema).toContain("@@unique([workId, userId])");
  });

  it("defines V1 batch and queue persistence models", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    expect(schema).toContain("model ImageBatch");
    expect(schema).toContain("model ImageBatchItem");
    expect(schema).toContain("batchItems");
    expect(schema).toContain("retryCount");
    expect(schema).toContain("queueStatus");
  });

  it("defines Phase B workbench tri-table + ImageTask association columns", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    // 三件套
    expect(schema).toContain("model WorkbenchProject");
    expect(schema).toContain("model CreativeSession");
    expect(schema).toContain("model VersionNode");

    // VersionNodeStatus enum 含 Task Dock 7 状态全集 + partial_image
    expect(schema).toContain("enum VersionNodeStatus");
    expect(schema).toContain("partial_image");

    // ImageTaskStatus 顺手加 timed_out（Cut 1 决议）
    expect(schema).toMatch(/enum ImageTaskStatus[\s\S]+?timed_out/);

    // CreativeSession 容纳 BranchMeta 4 字段（决议 2026-05-06：搬到 server）
    expect(schema).toContain("customLabel");
    expect(schema).toContain("isPinned");
    expect(schema).toContain("isArchived");
    expect(schema).toContain("lastReadAt");

    // ImageTask 关联字段全 nullable（决议 3：不回填假数据）
    expect(schema).toMatch(/projectId\s+String\?\s+@map\("project_id"\)/);
    expect(schema).toMatch(/sessionId\s+String\?\s+@map\("session_id"\)/);
    expect(schema).toMatch(/versionNodeId\s+String\?\s+@unique/);

    // VersionNode 链接到 board 字段（为 Phase C 预留）
    expect(schema).toContain("boardDocumentId");
    expect(schema).toContain("boardSnapshot");
    expect(schema).toContain("boardExportAssetId");

    // 级联约束：删 project → 删 session / version_node；删 session → 删 version_node
    expect(schema).toMatch(/CreativeSession\s+@relation[\s\S]+?onDelete:\s*Cascade/);

    // 索引：常用查询路径
    expect(schema).toContain("@@index([userId, sortOrder])");
    expect(schema).toContain("@@index([projectId, updatedAt])");
    expect(schema).toContain("@@index([sessionId, createdAt])");
  });
});
