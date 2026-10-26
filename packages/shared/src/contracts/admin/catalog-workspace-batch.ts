import { z } from "zod";

import { authedRoute } from "../_base.js";

const TAG = "Admin - Catalog Workspace";

const BATCH = "/api/admin/v1/catalog/workspace/batch";

export const workspaceTrustedCardsPreviewSchema = z.object({
  count: z.number().int().min(0),
  names: z.array(z.string()),
});

export const workspaceAcceptTrustedCardsResponseSchema = z.object({
  accepted: z.number().int().min(0),
  skipped: z.array(z.object({ name: z.string(), reason: z.string() })),
});

export const workspaceTrustedPrintingSchema = z.object({
  candidatePrintingId: z.string(),
  cardSlug: z.string(),
  label: z.string(),
});

export const workspaceTrustedPrintingsPreviewSchema = z.object({
  count: z.number().int().min(0),
  items: z.array(workspaceTrustedPrintingSchema),
});

export const workspaceAcceptTrustedPrintingsResponseSchema = z.object({
  accepted: z.number().int().min(0),
  skipped: z.array(z.object({ label: z.string(), reason: z.string() })),
});

export const workspaceSuggestedListingSchema = z.object({
  listingKey: z.string(),
  printingId: z.string(),
  label: z.string(),
  strength: z.string(),
});

export const workspaceSuggestedListingsPreviewSchema = z.object({
  count: z.number().int().min(0),
  items: z.array(workspaceSuggestedListingSchema),
});

export const workspaceAssignSuggestedListingsInputSchema = z.object({
  listingKeys: z.array(z.string().min(1)).optional(),
});

export const workspaceAssignSuggestedListingsResponseSchema = z.object({
  assigned: z.number().int().min(0),
});

export const adminCatalogWorkspaceBatchContract = {
  workspaceTrustedCardsPreview: authedRoute
    .route({ method: "GET", path: `${BATCH}/trusted-cards`, tags: [TAG] })
    .output(workspaceTrustedCardsPreviewSchema),
  workspaceAcceptTrustedCards: authedRoute
    .route({ method: "POST", path: `${BATCH}/trusted-cards`, tags: [TAG] })
    .output(workspaceAcceptTrustedCardsResponseSchema),
  workspaceTrustedPrintingsPreview: authedRoute
    .route({ method: "GET", path: `${BATCH}/trusted-printings`, tags: [TAG] })
    .output(workspaceTrustedPrintingsPreviewSchema),
  workspaceAcceptTrustedPrintings: authedRoute
    .route({ method: "POST", path: `${BATCH}/trusted-printings`, tags: [TAG] })
    .output(workspaceAcceptTrustedPrintingsResponseSchema),
  workspaceSuggestedListingsPreview: authedRoute
    .route({ method: "GET", path: `${BATCH}/suggested-listings`, tags: [TAG] })
    .output(workspaceSuggestedListingsPreviewSchema),
  workspaceAssignSuggestedListings: authedRoute
    .route({ method: "POST", path: `${BATCH}/suggested-listings`, tags: [TAG] })
    .input(workspaceAssignSuggestedListingsInputSchema)
    .output(workspaceAssignSuggestedListingsResponseSchema),
};

export type AdminCatalogWorkspaceBatchContract = typeof adminCatalogWorkspaceBatchContract;
export type WorkspaceTrustedCardsPreview = z.infer<typeof workspaceTrustedCardsPreviewSchema>;
export type WorkspaceAcceptTrustedCardsResponse = z.infer<
  typeof workspaceAcceptTrustedCardsResponseSchema
>;
export type WorkspaceTrustedPrinting = z.infer<typeof workspaceTrustedPrintingSchema>;
export type WorkspaceTrustedPrintingsPreview = z.infer<
  typeof workspaceTrustedPrintingsPreviewSchema
>;
export type WorkspaceAcceptTrustedPrintingsResponse = z.infer<
  typeof workspaceAcceptTrustedPrintingsResponseSchema
>;
export type WorkspaceSuggestedListing = z.infer<typeof workspaceSuggestedListingSchema>;
export type WorkspaceSuggestedListingsPreview = z.infer<
  typeof workspaceSuggestedListingsPreviewSchema
>;
export type WorkspaceAssignSuggestedListingsInput = z.infer<
  typeof workspaceAssignSuggestedListingsInputSchema
>;
export type WorkspaceAssignSuggestedListingsResponse = z.infer<
  typeof workspaceAssignSuggestedListingsResponseSchema
>;
