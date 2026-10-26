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

export const workspaceRecordFilterSchema = z.enum([
  "promo",
  "double-sided",
  "no-image",
  "mine",
  "substitute",
  "shared",
]);

export const WORKSPACE_RECORD_FILTERS = {
  printing: ["promo", "double-sided", "no-image", "mine"],
  face: ["no-image", "substitute", "shared"],
} as const satisfies Record<WorkspaceRecordKind, readonly WorkspaceRecordFilter[]>;

export const workspaceRecordsInputSchema = z
  .object({
    kind: workspaceRecordKindSchema,
    q: z.string().trim().min(1).optional(),
    filter: workspaceRecordFilterSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursor: z.string().min(1).optional(),
  })
  .refine(
    (input) =>
      input.filter === undefined ||
      (WORKSPACE_RECORD_FILTERS[input.kind] as readonly string[]).includes(input.filter),
    { message: "Filter does not apply to this kind", path: ["filter"] },
  );

export const workspaceImageStateSchema = z.enum(["own", "substitute", "none"]);

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
  channelLabel: z.string().nullable().optional(),
  status: z.enum(["announced", "released"]).nullable().optional(),
  imageCount: z.number().int().min(0).optional(),
  markers: z.array(z.string()).optional(),
  isDoubleSided: z.boolean().optional(),
  publicCode: z.string().optional(),
  artist: z.string().nullable().optional(),
  imageState: workspaceImageStateSchema.optional(),
  rarity: z.string().nullable().optional(),
  artVariant: z.string().nullable().optional(),
  updatedAt: isoDateTime,
});

export const workspaceRecordsResponseSchema = z.object({
  rows: z.array(workspaceRecordRowSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().min(0),
});

export const workspaceUploadSourceSchema = z.object({
  provider: z.string(),
  label: z.string(),
  uploadedAt: isoDateTime,
  newCards: z.number().int().min(0),
  newPrintings: z.number().int().min(0),
  updates: z.number().int().min(0),
  removed: z.number().int().min(0),
  open: z.number().int().min(0),
  new: z.number().int().min(0),
  oldestOpenAt: isoDateTime.nullable(),
  repeatedDifference: z
    .object({ field: z.string(), value: z.string(), count: z.number().int().min(2) })
    .nullable(),
});

export const workspaceUploadsResponseSchema = z.object({
  sources: z.array(workspaceUploadSourceSchema),
  contributors: z.object({ since: isoDateTime.nullable(), count: z.number().int().min(0) }),
});

export const workspaceEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  label: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  cardSlug: z.string().nullable(),
  createdAt: isoDateTime,
});

export const workspaceDecisionsInputSchema = z.object({
  since: isoDateTime.optional(),
});

export const workspaceHistoryInputSchema = z
  .object({
    printingId: z.uuid().optional(),
    faceId: z.uuid().optional(),
  })
  .refine((input) => (input.printingId === undefined) !== (input.faceId === undefined), {
    message: "Pass exactly one of printingId and faceId",
  });

export const workspaceEventsResponseSchema = z.object({
  events: z.array(workspaceEventSchema),
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
  workspaceUploads: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/uploads`, tags: [TAG] })
    .output(workspaceUploadsResponseSchema),
  workspaceDecisions: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/decisions`, tags: [TAG] })
    .input(workspaceDecisionsInputSchema)
    .output(workspaceEventsResponseSchema),
  workspaceHistory: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/history`, tags: [TAG] })
    .errors({ FORBIDDEN: { message: "Forbidden" }, NOT_FOUND: { message: "Not found" } })
    .input(workspaceHistoryInputSchema)
    .output(workspaceEventsResponseSchema),
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
export type WorkspaceRecordFilter = z.infer<typeof workspaceRecordFilterSchema>;
export type WorkspaceImageState = z.infer<typeof workspaceImageStateSchema>;
export type WorkspaceUploadSource = z.infer<typeof workspaceUploadSourceSchema>;
export type WorkspaceUploadsResponse = z.infer<typeof workspaceUploadsResponseSchema>;
export type WorkspaceEvent = z.infer<typeof workspaceEventSchema>;
export type WorkspaceDecisionsInput = z.infer<typeof workspaceDecisionsInputSchema>;
export type WorkspaceHistoryInput = z.infer<typeof workspaceHistoryInputSchema>;
export type WorkspaceEventsResponse = z.infer<typeof workspaceEventsResponseSchema>;
