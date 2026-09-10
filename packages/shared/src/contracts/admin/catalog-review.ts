import { isoDateTime } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import {
  cardSubmissionKindSchema,
  cardSubmissionReasonSchema,
  cardSubmissionStatusSchema,
} from "../card-submissions.js";
import {
  ACCEPT_CARD_FIELDS,
  ACCEPT_PRINTING_FIELDS,
  acceptPrintingFieldsSchema,
  cardFieldsSchema,
} from "./card-mutations.js";

const TAG = "Admin - Catalog Review";

const CATALOG = "/api/admin/v1/catalog";

export const reviewQueueKindSchema = z.enum([...cardSubmissionKindSchema.options, "source"]);

export const reviewQueueItemSchema = z.object({
  id: z.string(),
  kind: reviewQueueKindSchema,
  provider: z.string(),
  isContributor: z.boolean(),
  submitterName: z.string().nullable(),
  cardName: z.string(),
  normName: z.string(),
  cardSlug: z.string().nullable(),
  candidateCardId: z.string(),
  note: z.string().nullable(),
  changedFields: z.number().int().min(0),
  uncheckedPrintings: z.number().int().min(0),
  newPrintings: z.number().int().min(0),
  createdAt: isoDateTime,
});

export const reviewQueueResponseSchema = z.object({
  items: z.array(reviewQueueItemSchema),
  counts: z.object({
    open: z.number().int().min(0),
    contributors: z.number().int().min(0),
    sources: z.number().int().min(0),
  }),
});

const candidateCardIdParam = z.object({ candidateCardId: z.string().min(1) });

const cardFieldPickSchema = z.object({
  field: z.enum(ACCEPT_CARD_FIELDS),
  value: z.unknown(),
});

const printingFieldPickSchema = z.object({
  printingId: z.string().min(1),
  field: z.enum(ACCEPT_PRINTING_FIELDS),
  value: z.unknown(),
  source: z.enum(["provider", "manual"]).default("provider"),
});

const newPrintingPickSchema = z.object({
  candidatePrintingId: z.string().min(1),
  printingFields: acceptPrintingFieldsSchema,
});

const imagePickSchema = z.object({
  candidatePrintingId: z.string().min(1),
  printingId: z.string().min(1),
});

export const acceptSubmissionInputSchema = candidateCardIdParam.extend({
  cardFields: z.array(cardFieldPickSchema).default([]),
  printingFields: z.array(printingFieldPickSchema).default([]),
  newPrintings: z.array(newPrintingPickSchema).default([]),
  images: z.array(imagePickSchema).default([]),
});

export const acceptSubmissionResponseSchema = z.object({
  status: cardSubmissionStatusSchema,
  applied: z.number().int().min(0),
  createdPrintingIds: z.array(z.string()),
});

export const rejectSubmissionInputSchema = candidateCardIdParam.extend({
  reason: cardSubmissionReasonSchema,
  note: z.string().trim().min(1).max(2000).nullable(),
});

export const createCardFromCandidateInputSchema = candidateCardIdParam.extend({
  cardFields: cardFieldsSchema,
  printings: z.array(newPrintingPickSchema).default([]),
  images: z.array(z.object({ candidatePrintingId: z.string().min(1) })).default([]),
});

export const createCardFromCandidateResponseSchema = z.object({
  cardSlug: z.string(),
  printingsCreated: z.number().int().min(0),
});

export const catalogCardRowSchema = z.object({
  cardSlug: z.string().nullable(),
  name: z.string(),
  normName: z.string(),
  firstSetSlug: z.string().nullable(),
  firstSetName: z.string().nullable(),
  setSlugs: z.array(z.string()),
  shortCodes: z.array(z.string()),
  printingCount: z.number().int().min(0),
  printingsWithoutImage: z.number().int().min(0),
  proposals: z.number().int().min(0),
  newPrintings: z.number().int().min(0),
  uncheckedTrustedProviders: z.array(z.string()),
  needsAttention: z.boolean(),
  updatedAt: isoDateTime,
});

export const catalogCardListResponseSchema = z.object({
  rows: z.array(catalogCardRowSchema),
  counts: z.object({
    all: z.number().int().min(0),
    needsAttention: z.number().int().min(0),
    drafts: z.number().int().min(0),
  }),
});

export const catalogSourceKindSchema = z.enum(["contributors", "upload"]);

export const catalogSourceSchema = z.object({
  provider: z.string(),
  kind: catalogSourceKindSchema,
  rows: z.number().int().min(0),
  printingRows: z.number().int().min(0),
  inReview: z.number().int().min(0),
  isHidden: z.boolean(),
  isFavorite: z.boolean(),
  helperReviewable: z.boolean(),
  sortOrder: z.number().int(),
  lastUploadedAt: isoDateTime.nullable(),
  ignoredCount: z.number().int().min(0),
});

export const catalogSourcesResponseSchema = z.object({
  sources: z.array(catalogSourceSchema),
});

export const adminCatalogReviewContract = {
  reviewQueue: authedRoute
    .route({ method: "GET", path: `${CATALOG}/review`, tags: [TAG] })
    .output(reviewQueueResponseSchema),
  acceptSubmission: authedRoute
    .route({ method: "POST", path: `${CATALOG}/submissions/{candidateCardId}/accept`, tags: [TAG] })
    .errors({
      NOT_FOUND: { message: "Submission not found" },
      BAD_REQUEST: { message: "Invalid pick" },
      CONFLICT: { message: "Submission already settled" },
    })
    .input(acceptSubmissionInputSchema)
    .output(acceptSubmissionResponseSchema),
  rejectSubmission: authedRoute
    .route({
      method: "POST",
      path: `${CATALOG}/submissions/{candidateCardId}/reject`,
      tags: [TAG],
      successStatus: 204,
    })
    .errors({
      NOT_FOUND: { message: "Submission not found" },
      CONFLICT: { message: "Submission already settled" },
    })
    .input(rejectSubmissionInputSchema),
  catalogCards: authedRoute
    .route({ method: "GET", path: `${CATALOG}/cards`, tags: [TAG] })
    .output(catalogCardListResponseSchema),
  catalogSources: authedRoute
    .route({ method: "GET", path: `${CATALOG}/sources`, tags: [TAG] })
    .output(catalogSourcesResponseSchema),
  createCardFromCandidate: authedRoute
    .route({
      method: "POST",
      path: `${CATALOG}/candidates/{candidateCardId}/create-card`,
      tags: [TAG],
    })
    .errors({
      NOT_FOUND: { message: "Candidate not found" },
      BAD_REQUEST: { message: "Candidate cannot become a new card" },
      CONFLICT: { message: "Card already exists" },
    })
    .input(createCardFromCandidateInputSchema)
    .output(createCardFromCandidateResponseSchema),
};

export type AdminCatalogReviewContract = typeof adminCatalogReviewContract;
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
export type ReviewQueueKind = z.infer<typeof reviewQueueKindSchema>;
export type AcceptSubmissionInput = z.input<typeof acceptSubmissionInputSchema>;
export type AcceptSubmissionResponse = z.infer<typeof acceptSubmissionResponseSchema>;
export type RejectSubmissionInput = z.infer<typeof rejectSubmissionInputSchema>;
export type CreateCardFromCandidateInput = z.input<typeof createCardFromCandidateInputSchema>;
export type CreateCardFromCandidateResponse = z.infer<typeof createCardFromCandidateResponseSchema>;
export type CatalogCardRow = z.infer<typeof catalogCardRowSchema>;
export type CatalogCardListResponse = z.infer<typeof catalogCardListResponseSchema>;
export type CatalogSource = z.infer<typeof catalogSourceSchema>;
export type CatalogSourcesResponse = z.infer<typeof catalogSourcesResponseSchema>;
