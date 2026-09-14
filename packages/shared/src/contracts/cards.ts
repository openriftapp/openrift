import {
  cardTypeSchema,
  catalogCardResponseSchema,
  catalogPrintingResponseSchema,
  catalogSetResponseSchema,
  domainSchema,
  raritySchema,
} from "@openrift/shared/response-schemas";
import { oc } from "@orpc/contract";
import { z } from "zod";

/** Kept off `catalogPrintingResponseSchema` since that schema also backs the synced catalog, /promos, and /sets. */
export const cardDetailProductSchema = z.object({
  printingId: z.string().meta({ examples: ["019cfc3b-03d3-7dac-86c9-27900cd43727"] }),
  slug: z.string().meta({ examples: ["sfd-prerift-ezreal"] }),
  name: z.string().meta({ examples: ["SFD Pre-Rift Kit - Ezreal"] }),
  quantity: z
    .number()
    .int()
    .positive()
    .meta({ examples: [2] }),
});

/** `rarity` and `imageId` are null for a card with no usable printing art. */
export const cardDetailRelatedCardSchema = z.object({
  slug: z.string().meta({ examples: ["yasuo-windrider"] }),
  name: z.string().meta({ examples: ["Yasuo, Windrider"] }),
  types: z.array(cardTypeSchema).meta({ examples: [["Unit"]] }),
  domains: z.array(domainSchema).meta({ examples: [["Calm"]] }),
  rarity: raritySchema.nullable(),
  imageId: z
    .string()
    .nullable()
    .meta({ examples: ["019cfc3b-03d3-7dac-86c9-27900cd43727"] }),
});

export const cardDetailResponseSchema = z.object({
  card: catalogCardResponseSchema,
  printings: z.array(catalogPrintingResponseSchema),
  sets: z.array(catalogSetResponseSchema),
  // Product membership per printing, flat (one row per printing+product).
  // The web groups by `printingId` for the selected printing's "Found in" row.
  products: z.array(cardDetailProductSchema).meta({ examples: [[]] }),
  related: z.array(cardDetailRelatedCardSchema).meta({ examples: [[]] }),
  // Prices are not inlined here; read them from the /prices resource.
});

export const cardsContract = {
  detail: oc
    .route({ method: "GET", path: "/api/v1/cards/{cardSlug}", tags: ["Cards"] })
    .meta({ auth: "public", cache: "long", etag: true })
    .input(z.object({ cardSlug: z.string().min(1) }))
    .errors({ NOT_FOUND: { message: "Card not found" } })
    .output(cardDetailResponseSchema),
};

export type CardsContract = typeof cardsContract;
