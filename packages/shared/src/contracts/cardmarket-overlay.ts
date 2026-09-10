import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { marketplaceEnum } from "../types/pricing.js";
import { authedRoute } from "./_base.js";

extendZodWithOpenApi(z);

export const CARDMARKET_OVERLAY_MAX_LISTS = 50;

export const cardmarketOverlaySnapshotInputSchema = z.object({
  listIds: z.array(z.uuid()).min(1).max(CARDMARKET_OVERLAY_MAX_LISTS),
  /** The marketplace whose price rides along as a reference, from the viewer's own order. */
  marketplace: marketplaceEnum,
});

/** Cardmarket products carry one finish each, and the same product id exists for both. */
export const cardmarketOverlayProductSchema = z.object({
  idProduct: z.number().int().positive(),
  finish: z.enum(["normal", "foil"]),
  owned: z.number().int().min(0),
  wanted: z.number().int().min(0),
  priceCents: z.number().int().min(0).nullable(),
});

export const cardmarketOverlayListSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Rule-driven lists are expanded first, so this is what the snapshot actually covers. */
  entryCount: z.number().int().min(0),
});

export const cardmarketOverlaySnapshotResponseSchema = z
  .object({
    lists: z.array(cardmarketOverlayListSchema),
    marketplace: marketplaceEnum,
    generatedAt: z.iso.datetime({ offset: true }),
    products: z.array(cardmarketOverlayProductSchema),
  })
  .openapi("CardmarketOverlaySnapshot");

export type CardmarketOverlayProduct = z.infer<typeof cardmarketOverlayProductSchema>;
export type CardmarketOverlayList = z.infer<typeof cardmarketOverlayListSchema>;
export type CardmarketOverlaySnapshot = z.infer<typeof cardmarketOverlaySnapshotResponseSchema>;

export const cardmarketOverlayContract = {
  snapshot: authedRoute
    .route({
      method: "POST",
      path: "/api/v1/cardmarket/overlay/snapshot",
      tags: ["Cardmarket Overlay"],
    })
    .errors({ NOT_FOUND: { message: "List not found" } })
    .input(cardmarketOverlaySnapshotInputSchema)
    .output(cardmarketOverlaySnapshotResponseSchema),
};

export type CardmarketOverlayContract = typeof cardmarketOverlayContract;
