import {
  catalogCardResponseSchema,
  catalogPrintingResponseSchema,
  catalogSetResponseSchema,
  distributionChannelSchema,
} from "@openrift/shared/response-schemas";
import { oc } from "@orpc/contract";
import { z } from "zod";

const distributionChannelWithCountSchema = distributionChannelSchema.extend({
  cardCount: z.number().meta({ examples: [12] }),
  printingCount: z.number().meta({ examples: [24] }),
});

export const promosQuerySchema = z.object({
  language: z
    .string()
    .min(1)
    .max(8)
    .meta({ examples: ["EN"] }),
});

export const promosListResponseSchema = z.object({
  channels: z.array(distributionChannelWithCountSchema),
  cards: z.record(z.string(), catalogCardResponseSchema),
  printings: z.array(catalogPrintingResponseSchema),
  sets: z.array(catalogSetResponseSchema),
  languages: z.array(z.string()).meta({ examples: [["EN", "SC"]] }),
  // Prices are not inlined; read them from the /prices resource.
});

/** Scoped by language: the unscoped response is large enough to blank SSR. */
export const promosContract = {
  list: oc
    .route({ method: "GET", path: "/api/v1/promos", tags: ["Promos"] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(promosQuerySchema)
    .output(promosListResponseSchema),
};

export type PromosContract = typeof promosContract;
