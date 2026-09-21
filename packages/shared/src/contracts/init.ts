import { distributionChannelSchema } from "@openrift/shared/response-schemas";
import { oc } from "@orpc/contract";
import { z } from "zod";

export const keywordEntrySchema = z.object({
  color: z.string().meta({ examples: ["#24705f"] }),
  darkText: z.boolean().meta({ examples: [false] }),
  costKeyword: z.boolean().meta({ examples: [false] }),
  cardModifier: z.boolean().meta({ examples: [false] }),
  translations: z
    .record(z.string(), z.string())
    .optional()
    .meta({ examples: [{ de: "Beschleunigen" }] }),
});

export const enumRowSchema = z.object({
  slug: z.string().meta({ examples: ["Unit"] }),
  label: z.string().meta({ examples: ["Unit"] }),
  sortOrder: z.number().meta({ examples: [1] }),
});

export const coloredEnumRowSchema = enumRowSchema.extend({
  color: z
    .string()
    .nullable()
    .meta({ examples: ["#b8336a"] }),
});

const describedEnumRowSchema = enumRowSchema.extend({
  description: z
    .string()
    .nullable()
    .meta({ examples: ["Promo stamp around the rarity symbol"] }),
});

const customTagSchema = z.object({
  id: z.string().meta({ examples: ["019d4999-4219-72f6-b7bb-64004e1b1bff"] }),
  slug: z.string().meta({ examples: ["bandle-city"] }),
  label: z.string().meta({ examples: ["Bandle City"] }),
  category: z.string().meta({ examples: ["region"] }),
  categoryLabel: z.string().meta({ examples: ["Region"] }),
  description: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  sortOrder: z.number().meta({ examples: [0] }),
});

export const initResponseSchema = z.object({
  enums: z.object({
    cardTypes: z.array(enumRowSchema),
    rarities: z.array(coloredEnumRowSchema),
    domains: z.array(coloredEnumRowSchema),
    superTypes: z.array(enumRowSchema),
    finishes: z.array(enumRowSchema),
    artVariants: z.array(enumRowSchema),
    cardSizes: z.array(enumRowSchema),
    deckFormats: z.array(enumRowSchema),
    deckZones: z.array(enumRowSchema),
    conditions: z.array(enumRowSchema),
    graders: z.array(enumRowSchema),
    languages: z.array(coloredEnumRowSchema),
    markers: z.array(describedEnumRowSchema),
  }),
  keywords: z.record(z.string(), keywordEntrySchema),
  distributionChannels: z.array(distributionChannelSchema).meta({ examples: [[]] }),
  customTags: z.array(customTagSchema).meta({ examples: [[]] }),
  championIdentifierTags: z.array(z.string()).meta({ examples: [["Garen", "Karma", "Yasuo"]] }),
  tagCategories: z.array(enumRowSchema).meta({
    examples: [[{ slug: "region", label: "Region", sortOrder: 0 }]],
  }),
  tagCategoryMap: z.record(z.string(), z.string()).meta({
    examples: [{ Ionia: "region", Poro: "species" }],
  }),
});

export const initContract = {
  get: oc
    .route({ method: "GET", path: "/api/v1/init", tags: ["Init"] })
    .meta({ auth: "public", cache: "long", etag: true })
    .output(initResponseSchema),
};

export type InitContract = typeof initContract;
