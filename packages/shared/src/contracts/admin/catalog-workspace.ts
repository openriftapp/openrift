import { isoDateTime } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";

const TAG = "Admin - Catalog Workspace";

const WORKSPACE = "/api/admin/v1/catalog/workspace";

export const workspaceOwnerSchema = z.enum(["card", "face", "printing"]);

export const workspaceSegmentSchema = z.enum(["open", "new"]);

export const workspaceReasonSchema = z.enum([
  "source-difference",
  "contributor-proposal",
  "new-card",
  "new-printing",
  "new-image",
  "listing",
]);

export const workspaceQueueItemSchema = z.object({
  id: z.string(),
  owner: workspaceOwnerSchema,
  segment: workspaceSegmentSchema,
  ownerId: z.string(),
  cardSlug: z.string().nullable(),
  cardName: z.string(),
  label: z.string(),
  reason: workspaceReasonSchema,
  provider: z.string().nullable(),
  isContributor: z.boolean(),
  decisions: z.number().int().min(0),
  fields: z.array(z.string()),
  createdAt: isoDateTime,
});

export const workspaceOwnerCountsSchema = z.object({
  open: z.number().int().min(0),
  new: z.number().int().min(0),
  oldestAt: isoDateTime.nullable(),
});

export const workspaceQueueInputSchema = z.object({
  owner: workspaceOwnerSchema.optional(),
});

export const workspaceQueueResponseSchema = z.object({
  items: z.array(workspaceQueueItemSchema),
  counts: z.object({
    card: workspaceOwnerCountsSchema,
    face: workspaceOwnerCountsSchema,
    printing: workspaceOwnerCountsSchema,
  }),
  doneToday: z.number().int().min(0),
});

export const workspaceRecordKindSchema = z.enum(["printing", "face"]);

export const workspaceRecordsInputSchema = z.object({
  kind: workspaceRecordKindSchema,
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursor: z.string().min(1).optional(),
});

export const workspaceRecordRowSchema = z.object({
  id: z.string(),
  cardSlug: z.string(),
  cardName: z.string(),
  setName: z.string(),
  shortCode: z.string(),
  language: z.string(),
  finish: z.string(),
  imageUrl: z.string().nullable(),
  faceCount: z.number().int().min(0).optional(),
  printingCount: z.number().int().min(0).optional(),
  isPromo: z.boolean().optional(),
  createdByMe: z.boolean().optional(),
  updatedAt: isoDateTime,
});

export const workspaceRecordsResponseSchema = z.object({
  rows: z.array(workspaceRecordRowSchema),
  nextCursor: z.string().nullable(),
});

export const adminCatalogWorkspaceContract = {
  workspaceQueue: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/queue`, tags: [TAG] })
    .input(workspaceQueueInputSchema)
    .output(workspaceQueueResponseSchema),
  workspaceRecords: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/records`, tags: [TAG] })
    .errors({ BAD_REQUEST: { message: "Invalid cursor" } })
    .input(workspaceRecordsInputSchema)
    .output(workspaceRecordsResponseSchema),
};

export type AdminCatalogWorkspaceContract = typeof adminCatalogWorkspaceContract;
export type WorkspaceOwner = z.infer<typeof workspaceOwnerSchema>;
export type WorkspaceSegment = z.infer<typeof workspaceSegmentSchema>;
export type WorkspaceReason = z.infer<typeof workspaceReasonSchema>;
export type WorkspaceQueueItem = z.infer<typeof workspaceQueueItemSchema>;
export type WorkspaceOwnerCounts = z.infer<typeof workspaceOwnerCountsSchema>;
export type WorkspaceQueueInput = z.input<typeof workspaceQueueInputSchema>;
export type WorkspaceQueueResponse = z.infer<typeof workspaceQueueResponseSchema>;
export type WorkspaceRecordKind = z.infer<typeof workspaceRecordKindSchema>;
export type WorkspaceRecordsInput = z.infer<typeof workspaceRecordsInputSchema>;
export type WorkspaceRecordRow = z.infer<typeof workspaceRecordRowSchema>;
export type WorkspaceRecordsResponse = z.infer<typeof workspaceRecordsResponseSchema>;
