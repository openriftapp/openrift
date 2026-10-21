import { z } from "zod";

import { COMPARABLE_CARD_FIELDS } from "../../catalog-field-compare.js";
import { authedRoute } from "../_base.js";

const TAG = "Admin - Catalog Workspace";

const SAME_DIFFERENCE = "/api/admin/v1/catalog/workspace/same-difference";

/** `value` and `currentValue` are JSON-encoded field values. */
export const workspaceSameDifferenceInputSchema = z.object({
  provider: z.string().trim().min(1),
  field: z.enum(COMPARABLE_CARD_FIELDS),
  value: z.string().min(1),
  currentValue: z.string().min(1).optional(),
});

export const workspaceSameDifferenceResponseSchema = z.object({
  count: z.number().int().min(0),
  candidateCardIds: z.array(z.string()),
  cards: z.array(z.object({ slug: z.string(), name: z.string() })),
});

export const workspaceDiscardSameDifferenceResponseSchema = z.object({
  checked: z.number().int().min(0),
  candidateCardIds: z.array(z.string()),
});

export const adminCatalogWorkspaceBulkContract = {
  workspaceSameDifference: authedRoute
    .route({ method: "GET", path: SAME_DIFFERENCE, tags: [TAG] })
    .errors({ BAD_REQUEST: { message: "Invalid value" } })
    .input(workspaceSameDifferenceInputSchema)
    .output(workspaceSameDifferenceResponseSchema),
  workspaceDiscardSameDifference: authedRoute
    .route({ method: "POST", path: `${SAME_DIFFERENCE}/discard`, tags: [TAG] })
    .errors({ BAD_REQUEST: { message: "Invalid value" } })
    .input(workspaceSameDifferenceInputSchema)
    .output(workspaceDiscardSameDifferenceResponseSchema),
};

export type AdminCatalogWorkspaceBulkContract = typeof adminCatalogWorkspaceBulkContract;
export type WorkspaceSameDifferenceInput = z.infer<typeof workspaceSameDifferenceInputSchema>;
export type WorkspaceSameDifferenceResponse = z.infer<typeof workspaceSameDifferenceResponseSchema>;
export type WorkspaceDiscardSameDifferenceResponse = z.infer<
  typeof workspaceDiscardSameDifferenceResponseSchema
>;
