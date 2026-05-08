import { z } from "zod";

const idSchema = z.string().trim().min(1).max(200);
const titleSchema = z.string().trim().min(1).max(120);
const labelSchema = z.string().trim().min(1).max(80);
const assetIdSchema = z.string().trim().min(1).max(200);
const jsonSnapshotSchema = z.unknown();
const versionNodeStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "partial_image"
]);

export const workbenchListSchema = z.object({
  cursor: idSchema.nullable().optional(),
  limit: z.number().int().min(1).max(50).optional()
});

export const workbenchProjectCreateSchema = z.object({
  title: titleSchema,
  sortOrder: z.number().int().optional(),
  collapsed: z.boolean().optional(),
  activeSessionId: idSchema.nullable().optional()
});

export const workbenchProjectUpdateSchema = z.object({
  title: titleSchema.optional(),
  sortOrder: z.number().int().optional(),
  collapsed: z.boolean().optional(),
  activeSessionId: idSchema.nullable().optional()
});

export const creativeSessionCreateSchema = z.object({
  projectId: idSchema,
  title: titleSchema,
  forkParentVersionNodeId: idSchema.nullable().optional(),
  activeVersionNodeId: idSchema.nullable().optional(),
  customLabel: labelSchema.nullable().optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  lastReadAt: dateInputSchema().nullable().optional()
});

export const creativeSessionUpdateSchema = z.object({
  title: titleSchema.optional(),
  forkParentVersionNodeId: idSchema.nullable().optional(),
  activeVersionNodeId: idSchema.nullable().optional(),
  customLabel: labelSchema.nullable().optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  lastReadAt: dateInputSchema().nullable().optional()
});

export const creativeSessionListSchema = workbenchListSchema.extend({
  projectId: idSchema
});

export const versionNodeCreateSchema = z.object({
  projectId: idSchema,
  sessionId: idSchema,
  parentVersionNodeId: idSchema.nullable().optional(),
  promptSnapshot: z.string().trim().min(1).max(20_000),
  paramsSnapshot: jsonSnapshotSchema,
  sourceAssetIds: z.array(assetIdSchema).default([]),
  outputAssetIds: z.array(assetIdSchema).default([]),
  boardDocumentId: idSchema.nullable().optional(),
  boardSnapshot: jsonSnapshotSchema.nullable().optional(),
  boardExportAssetId: idSchema.nullable().optional(),
  branchLabel: labelSchema.nullable().optional(),
  status: versionNodeStatusSchema.default("queued")
});

export const versionNodeUpdateSchema = z.object({
  status: versionNodeStatusSchema.optional(),
  outputAssetIds: z.array(assetIdSchema).optional(),
  branchLabel: labelSchema.nullable().optional(),
  boardDocumentId: idSchema.nullable().optional(),
  boardSnapshot: jsonSnapshotSchema.nullable().optional(),
  boardExportAssetId: idSchema.nullable().optional()
});

export const versionNodeListSchema = workbenchListSchema.extend({
  sessionId: idSchema
});

export type WorkbenchProjectCreateInput = z.infer<
  typeof workbenchProjectCreateSchema
>;
export type WorkbenchProjectUpdateInput = z.infer<
  typeof workbenchProjectUpdateSchema
>;
export type WorkbenchListInput = z.infer<typeof workbenchListSchema>;
export type CreativeSessionCreateInput = z.infer<
  typeof creativeSessionCreateSchema
>;
export type CreativeSessionUpdateInput = z.infer<
  typeof creativeSessionUpdateSchema
>;
export type CreativeSessionListInput = z.infer<typeof creativeSessionListSchema>;
export type VersionNodeCreateInput = z.infer<typeof versionNodeCreateSchema>;
export type VersionNodeUpdateInput = z.infer<typeof versionNodeUpdateSchema>;
export type VersionNodeListInput = z.infer<typeof versionNodeListSchema>;
export type VersionNodeStatus = z.infer<typeof versionNodeStatusSchema>;

function dateInputSchema() {
  return z.preprocess((value) => {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date;
    }

    return value;
  }, z.date());
}
