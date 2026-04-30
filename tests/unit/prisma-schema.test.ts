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
});
