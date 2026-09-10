import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { CARDMARKET_UNRESOLVED_REASONS } from "../cardmarket-stock.js";
import { authedRoute } from "./_base.js";

extendZodWithOpenApi(z);

export const CARDMARKET_PICKS_MAX_ROWS = 300;

export const cardmarketPickRowSchema = z.object({
  idProduct: z.number().int().positive(),
  isFoil: z.boolean(),
  /** 0 when the extension could not read the language off the article. */
  idLanguage: z.number().int().min(0),
});

export const cardmarketPicksResolveInputSchema = z.object({
  rows: z.array(cardmarketPickRowSchema).min(1).max(CARDMARKET_PICKS_MAX_ROWS),
});

/** One row per input row, in input order. */
export const cardmarketPicksResolveResponseSchema = z
  .object({
    rows: z.array(
      z.object({
        idProduct: z.number().int(),
        isFoil: z.boolean(),
        idLanguage: z.number().int(),
        printingId: z.uuid().nullable(),
        reason: z.enum(CARDMARKET_UNRESOLVED_REASONS).nullable(),
        productName: z.string().nullable(),
        languageName: z.string().nullable().openapi({ example: "German" }),
      }),
    ),
  })
  .openapi("CardmarketPicksResolution");

export type CardmarketPickRow = z.infer<typeof cardmarketPickRowSchema>;
export type CardmarketPicksResolution = z.infer<typeof cardmarketPicksResolveResponseSchema>;

export const cardmarketPicksContract = {
  resolve: authedRoute
    .route({
      method: "POST",
      path: "/api/v1/cardmarket/picks/resolve",
      tags: ["Cardmarket Picks"],
    })
    .input(cardmarketPicksResolveInputSchema)
    .output(cardmarketPicksResolveResponseSchema),
};

export type CardmarketPicksContract = typeof cardmarketPicksContract;
