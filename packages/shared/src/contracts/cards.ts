import {
  catalogCardResponseValueSchema,
  catalogPrintingResponseValueSchema,
} from "@openrift/shared/contracts/catalog";
import {
  cardTypeSchema,
  catalogCardResponseSchema,
  catalogSetResponseSchema,
  distributionChannelSchema,
  domainSchema,
  markerSchema,
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
  cards: z.record(z.string(), catalogCardResponseValueSchema).meta({
    description:
      "The other cards these printings show (the other face of a double-sided printing), keyed by card id. The requested card is `card` and never in here.",
    examples: [{}],
  }),
  printings: z.record(z.string(), catalogPrintingResponseValueSchema).meta({
    description:
      "Every printing of the card, keyed by printing id. The card may be either face of a double-sided printing: match on `cardId`.",
  }),
  sets: z.array(catalogSetResponseSchema),
  markers: z
    .array(markerSchema)
    .meta({ description: "The markers these printings name, in display order." }),
  distributionChannels: z
    .array(distributionChannelSchema)
    .meta({ description: "The distribution channels these printings name, with their parents." }),
  // Product membership per printing, flat (one row per printing+product).
  // The web groups by `printingId` for the selected printing's "Found in" row.
  products: z.array(cardDetailProductSchema).meta({ examples: [[]] }),
  // Prices are not inlined here; read them from the /prices resource.
});

export const cardRelatedResponseSchema = z.object({
  related: z.array(cardDetailRelatedCardSchema).meta({ examples: [[]] }),
});

const cardSlugParamSchema = z.object({
  cardSlug: z
    .string()
    .min(1)
    .meta({ description: "The card's slug, as in its OpenRift URL.", examples: ["jinx-rebel"] }),
});

export const cardsContract = {
  detail: oc
    .route({
      method: "GET",
      path: "/api/v1/cards/{cardSlug}",
      tags: ["Cards"],
      operationId: "getCard",
      summary: "One card by slug",
      description:
        "The card, every printing of it, the sets and products those printings come in, and the markers and distribution channels they name. Printings use the same shape as `/catalog`, so one type covers both. Prices are separate; see `/prices`.",
    })
    .meta({ auth: "public", developerApi: true, cache: "long", etag: true })
    .input(cardSlugParamSchema)
    .errors({ NOT_FOUND: { message: "Card not found" } })
    .output(cardDetailResponseSchema),
  related: oc
    .route({
      method: "GET",
      path: "/api/v1/cards/{cardSlug}/related",
      tags: ["Cards"],
      description:
        "Internal: the card page's related-cards strip. A heuristic pick, not part of the developer API.",
    })
    .meta({ auth: "public", cache: "long", etag: true })
    .input(cardSlugParamSchema)
    .errors({ NOT_FOUND: { message: "Card not found" } })
    .output(cardRelatedResponseSchema),
};

export type CardsContract = typeof cardsContract;
