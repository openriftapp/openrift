import { enumRowSchema, keywordEntrySchema } from "@openrift/shared/contracts/init";
import {
  catalogCardResponseSchema,
  catalogFaceFieldsSchema,
  catalogPrintingResponseSchema,
  catalogSetResponseSchema,
  distributionChannelSchema,
  markerSchema,
} from "@openrift/shared/response-schemas";
import { oc } from "@orpc/contract";
import { z } from "zod";

// Wire-only shapes for /catalog: identity lives in the map key, not the value.
export const catalogCardResponseValueSchema = catalogCardResponseSchema.omit({ id: true });

const catalogMarkerSlugsSchema = z.array(z.string()).meta({
  examples: [["promo"]],
  description: "Marker slugs; the definitions are in the response's `markers`.",
});

export const catalogPrintingChannelRefSchema = z.object({
  channel: z.string().meta({
    examples: ["nexus-night"],
    description:
      "A distribution channel slug; the definitions are in the response's `distributionChannels`.",
  }),
  note: z
    .string()
    .optional()
    .meta({ examples: ["Top 8"] }),
});

export const catalogPrintingSide2Schema = catalogFaceFieldsSchema
  .extend({
    markers: catalogMarkerSlugsSchema,
  })
  .meta({ description: "One face of a printing: everything printed on that side of the card." });

// The value carries side 1, whose `faceId` is omitted when it equals the printing id. A
// double-sided printing adds its second side as `side2`.
export const catalogPrintingResponseValueSchema = catalogPrintingResponseSchema
  .omit({ printingId: true, side: true, otherSide: true })
  .extend({
    markers: catalogMarkerSlugsSchema,
    distributionChannels: z.array(catalogPrintingChannelRefSchema).meta({
      examples: [[]],
      description:
        "Where the printing was distributed, as channel slugs with an optional note; the definitions are in the response's `distributionChannels`.",
    }),
    faceId: catalogPrintingResponseSchema.shape.faceId
      .optional()
      .meta({ description: "Omitted when it equals the printing id." }),
    side2: catalogPrintingSide2Schema.optional().meta({
      description: "The second face of a double-sided printing. Absent on single-sided printings.",
    }),
  })
  .meta({
    description:
      "One physical printing. The top-level face fields describe side 1, the face whose `shortCode` sorts first (a face is a side in field names); a double-sided printing adds the other face as `side2`. Either face may show the card you asked for, so match on `cardId`. The value is identical on `/catalog` and `/cards/{cardSlug}`, except for `slug` and `canonicalRank`.",
  });

export const catalogKeywordSchema = keywordEntrySchema.omit({ color: true, darkText: true });

export const catalogEnumsSchema = z.object({
  cardTypes: z.array(enumRowSchema),
  superTypes: z.array(enumRowSchema),
  domains: z.array(enumRowSchema),
  rarities: z.array(enumRowSchema),
  finishes: z.array(enumRowSchema),
  artVariants: z.array(enumRowSchema),
  cardSizes: z.array(enumRowSchema),
  languages: z.array(enumRowSchema),
});

export const catalogResponseSchema = z.object({
  sets: z.array(catalogSetResponseSchema),
  cards: z.record(z.string(), catalogCardResponseValueSchema),
  printings: z.record(z.string(), catalogPrintingResponseValueSchema),
  /** In display order. */
  markers: z.array(markerSchema),
  distributionChannels: z.array(distributionChannelSchema),
  enums: catalogEnumsSchema,
  /** Keyed by the English keyword name that `card.keywords` carries. */
  keywords: z.record(z.string(), catalogKeywordSchema),
  tagCategories: z.array(enumRowSchema),
  /** Card tag to its `tagCategories` slug. */
  tagCategoryMap: z.record(z.string(), z.string()),
});

const LANGUAGE_CSV_MAX_CHARS = 200;

const languageCsv = z
  .string()
  .min(1)
  .max(LANGUAGE_CSV_MAX_CHARS)
  .meta({ examples: ["EN"] });

export const catalogInputSchema = z.object({
  v: z.string().optional().meta({
    description:
      "The ETag of the catalog you last saw. When it still matches, the response is marked immutable so caches keep it for a year. Optional.",
  }),
  langs: languageCsv.optional().meta({
    description:
      "Comma-separated language codes (see `enums.languages`). Only printings in these languages are returned; unknown codes match nothing. Omit it for every language.",
    examples: ["EN,FR"],
  }),
});

export const catalogPrintingsInputSchema = z.object({
  v: z.string().optional(),
  exceptLangs: languageCsv,
});

export const catalogPrintingsResponseSchema = z.object({
  printings: z.record(z.string(), catalogPrintingResponseValueSchema),
});

/**
 * `/catalog?langs=` and `/catalog/printings?exceptLangs=` split the printings exactly.
 * Both carry the catalog's ETag, so one `?v=` token addresses both.
 */
export const catalogContract = {
  catalog: oc
    .route({
      method: "GET",
      path: "/api/v1/catalog",
      tags: ["Catalog"],
      operationId: "getCatalog",
      summary: "The whole card catalog",
      description:
        "Every set, card and printing in one response, with the markers, distribution channels, keywords and enum labels they name. Cards and printings are keyed by id. A card is the game object; a printing is one physical version of it. Fetch it once, keep it for an hour, then revalidate with `If-None-Match`.",
    })
    .meta({ auth: "public", developerApi: true, cache: "long", etag: true })
    .input(catalogInputSchema)
    .output(catalogResponseSchema),
  printings: oc
    .route({ method: "GET", path: "/api/v1/catalog/printings", tags: ["Catalog"] })
    .meta({ auth: "public", cache: "long", etag: true })
    .input(catalogPrintingsInputSchema)
    .output(catalogPrintingsResponseSchema),
};

export type CatalogContract = typeof catalogContract;
