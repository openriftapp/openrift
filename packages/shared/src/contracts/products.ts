import {
  catalogCardResponseSchema,
  catalogPrintingResponseSchema,
  catalogSetResponseSchema,
  finishSchema,
  raritySchema,
} from "@openrift/shared/response-schemas";
import { isoDateTime } from "@openrift/shared/schemas";
import { oc } from "@orpc/contract";
import { z } from "zod";

export const productSlugRegex = /^[a-z0-9][a-z0-9-]{2,79}$/u;

export const RESERVED_PRODUCT_SLUGS = ["new", "create", "settings", "admin"] as const;

export const productSlugSchema = z
  .string()
  .regex(productSlugRegex, "Slug must be 3-80 chars of lowercase letters, digits, and dashes")
  .refine(
    (slug) => !(RESERVED_PRODUCT_SLUGS as readonly string[]).includes(slug),
    "This slug is reserved",
  );

export const productCoverCardSchema = z.object({
  printingId: z.string(),
  imageId: z.string(),
  name: z.string(),
});

export const productSetSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});

export const productSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  set: productSetSchema.nullable(),
  printingCount: z.number(),
  cardTotal: z.number(),
  coverCards: z.array(productCoverCardSchema),
  updatedAt: isoDateTime,
});

export const PRODUCT_COVER_CARD_COUNT = 4;

export const productContentSchema = z.object({
  printingId: z.string(),
  quantity: z.number(),
});

export const productsListResponseSchema = z.object({ products: z.array(productSummarySchema) });

export const variantSiblingSummarySchema = z.object({
  languages: z.array(z.string()).meta({ examples: [["EN", "FR"]] }),
  rarities: z.array(raritySchema).meta({ examples: [["Epic"]] }),
  finishes: z.array(finishSchema).meta({ examples: [["normal", "foil"]] }),
  markerSlugs: z
    .array(z.array(z.string()))
    .meta({ description: "Each distinct marker set, as slugs.", examples: [[[], ["promo"]]] }),
  signed: z.array(z.boolean()).meta({ examples: [[false]] }),
  otherSides: z
    .array(
      z.object({
        shortCode: z.string().meta({ examples: ["OGN-271"] }),
        cardName: z.string().meta({ examples: ["Recruit"] }),
        otherShortCode: z.string().meta({ examples: ["OGN-272"] }),
      }),
    )
    .meta({
      description:
        "Each double-sided printing's own short code with the other face's card name and short code.",
      examples: [[]],
    }),
});

export const productDetailResponseSchema = z.object({
  product: productSummarySchema,
  contents: z.array(productContentSchema),
  cards: z.record(z.string(), catalogCardResponseSchema),
  printings: z.array(catalogPrintingResponseSchema),
  sets: z.array(catalogSetResponseSchema),
  variantSiblings: z.record(z.string(), variantSiblingSummarySchema).meta({
    description:
      "For each card in the product, keyed by card id, the distinct values across every printing of that card in the catalog, including printings outside this product. A printing's variant label names a value only when the card's printings differ in it.",
  }),
});

export const productsContract = {
  list: oc
    .route({ method: "GET", path: "/api/v1/products", tags: ["Products"] })
    .meta({ auth: "public", cache: "short", etag: true })
    .output(productsListResponseSchema),
  get: oc
    .route({ method: "GET", path: "/api/v1/products/{slug}", tags: ["Products"] })
    .meta({ auth: "public", cache: "short", etag: true })
    .errors({ NOT_FOUND: { message: "Product not found" } })
    .input(z.object({ slug: z.string() }))
    .output(productDetailResponseSchema),
};

export type ProductsContract = typeof productsContract;
export type ProductSet = z.infer<typeof productSetSchema>;
export type ProductCoverCard = z.infer<typeof productCoverCardSchema>;
export type ProductSummary = z.infer<typeof productSummarySchema>;
export type ProductContent = z.infer<typeof productContentSchema>;
export type ProductsListResponse = z.infer<typeof productsListResponseSchema>;
export type ProductDetailResponse = z.infer<typeof productDetailResponseSchema>;
