import { isoDateTime } from "@openrift/shared/schemas";
import {
  WORKSPACE_RECORD_SORTS,
  WORKSPACE_REASONS,
  WORKSPACE_RECORD_FILTER_VALUES,
} from "@openrift/shared/workspace-kinds";
import { z } from "zod";

import { authedRoute } from "../_base.js";

const TAG = "Admin - Catalog Workspace";

const WORKSPACE = "/api/admin/v1/catalog/workspace";

export const workspaceOwnerSchema = z.enum(["card", "face", "printing"]);

export const workspaceSegmentSchema = z.enum(["open", "new"]);

export const workspaceReasonSchema = z.enum(WORKSPACE_REASONS);

export const workspaceListingVariantSchema = z.object({
  language: z.string().nullable(),
  finish: z.string(),
  count: z.number().int().min(1),
});

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
  variants: z.array(workspaceListingVariantSchema).optional(),
  createdAt: isoDateTime,
});

export const workspaceQueueInputSchema = z.object({
  owner: workspaceOwnerSchema.optional(),
});

export const workspaceQueueResponseSchema = z.object({
  items: z.array(workspaceQueueItemSchema),
});

export const reviewCardSchema = z.object({
  key: z.string(),
  cardSlug: z.string().nullable(),
  cardName: z.string(),
  hasContribution: z.boolean(),
  providers: z.array(z.string()),
  pending: z.object({
    cardFields: z.array(z.string()),
    newPrintings: z.number().int().min(0),
    faces: z.number().int().min(0),
    printings: z.number().int().min(0),
    newImages: z.number().int().min(0),
    failedImages: z.number().int().min(0),
  }),
  waitingSince: isoDateTime,
});

export const reviewCardsResponseSchema = z.object({
  cards: z.array(reviewCardSchema),
});

export const workspaceRecordKindSchema = z.enum(["printing", "face"]);

export const workspaceRecordFilterSchema = z.enum(WORKSPACE_RECORD_FILTER_VALUES);

export const WORKSPACE_RECORD_FILTERS = {
  printing: ["promo", "double-sided", "no-image", "mine"],
  face: ["no-image", "substitute", "shared"],
} as const satisfies Record<WorkspaceRecordKind, readonly WorkspaceRecordFilter[]>;

export type WorkspaceRecordSort = (typeof WORKSPACE_RECORD_SORTS)[number];

export const workspaceRecordsInputSchema = z
  .object({
    kind: workspaceRecordKindSchema,
    q: z.string().trim().min(1).optional(),
    filter: workspaceRecordFilterSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursor: z.string().min(1).optional(),
    sort: z.enum(WORKSPACE_RECORD_SORTS).optional(),
    direction: z.enum(["asc", "desc"]).optional(),
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

export const workspaceEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  label: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  cardSlug: z.string().nullable(),
  createdAt: isoDateTime,
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
    .meta({ adminSections: ["card-review", "printing-desk"] })
    .input(workspaceQueueInputSchema)
    .output(workspaceQueueResponseSchema),
  workspaceListings: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/listings`, tags: [TAG] })
    .output(workspaceQueueResponseSchema),
  reviewCards: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/review`, tags: [TAG] })
    .meta({ adminSections: ["card-review"] })
    .output(reviewCardsResponseSchema),
  workspaceRecords: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/records`, tags: [TAG] })
    .meta({ adminSections: ["card-review", "printing-desk"] })
    .errors({ BAD_REQUEST: { message: "Invalid cursor" } })
    .input(workspaceRecordsInputSchema)
    .output(workspaceRecordsResponseSchema),
  workspaceCardImages: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/card-images`, tags: [TAG] })
    .meta({ adminSections: ["card-review", "printing-desk"] })
    .output(z.object({ images: z.record(z.string(), z.string()) })),
  workspaceHistory: authedRoute
    .route({ method: "GET", path: `${WORKSPACE}/history`, tags: [TAG] })
    .meta({ adminSections: ["card-review", "printing-desk"] })
    .errors({ FORBIDDEN: { message: "Forbidden" }, NOT_FOUND: { message: "Not found" } })
    .input(workspaceHistoryInputSchema)
    .output(workspaceEventsResponseSchema),
};

export type AdminCatalogWorkspaceContract = typeof adminCatalogWorkspaceContract;
export type WorkspaceOwner = z.infer<typeof workspaceOwnerSchema>;
export type WorkspaceSegment = z.infer<typeof workspaceSegmentSchema>;
export type WorkspaceReason = z.infer<typeof workspaceReasonSchema>;
export type WorkspaceListingVariant = z.infer<typeof workspaceListingVariantSchema>;
export type WorkspaceQueueItem = z.infer<typeof workspaceQueueItemSchema>;
export type WorkspaceQueueInput = z.input<typeof workspaceQueueInputSchema>;
export type WorkspaceQueueResponse = z.infer<typeof workspaceQueueResponseSchema>;
export type ReviewCard = z.infer<typeof reviewCardSchema>;
export type ReviewCardsResponse = z.infer<typeof reviewCardsResponseSchema>;
export type WorkspaceRecordKind = z.infer<typeof workspaceRecordKindSchema>;
export type WorkspaceRecordsInput = z.infer<typeof workspaceRecordsInputSchema>;
export type WorkspaceRecordRow = z.infer<typeof workspaceRecordRowSchema>;
export type WorkspaceRecordsResponse = z.infer<typeof workspaceRecordsResponseSchema>;
export type WorkspaceRecordFilter = z.infer<typeof workspaceRecordFilterSchema>;
export type WorkspaceImageState = z.infer<typeof workspaceImageStateSchema>;
export type WorkspaceEvent = z.infer<typeof workspaceEventSchema>;
export type WorkspaceHistoryInput = z.infer<typeof workspaceHistoryInputSchema>;
export type WorkspaceEventsResponse = z.infer<typeof workspaceEventsResponseSchema>;
