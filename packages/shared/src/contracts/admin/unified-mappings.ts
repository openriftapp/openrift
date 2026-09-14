import {
  artVariantSchema,
  cardSizeSchema,
  domainSchema,
  finishSchema,
  raritySchema,
  superTypeSchema,
} from "@openrift/shared/response-schemas";
import { marketplaceEnum } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import { groupKindEnum } from "./marketplace-groups.js";

export const stagedProductResponseSchema = z.object({
  externalId: z.number().meta({ examples: [748_215] }),
  productName: z.string().meta({ examples: ["Jinx, Rebel (Foil)"] }),
  finish: z.string().meta({ examples: ["foil"] }),
  /** `null` when the marketplace doesn't expose language as a SKU dimension (CM, TCG). */
  language: z
    .string()
    .nullable()
    .meta({ examples: ["EN"] }),
  marketCents: z
    .number()
    .nullable()
    .meta({ examples: [452] }),
  lowCents: z
    .number()
    .nullable()
    .meta({ examples: [325] }),
  currency: z.string().meta({ examples: ["USD"] }),
  recordedAt: z.string().meta({ examples: ["2026-04-01T12:00:00.000Z"] }),
  midCents: z
    .number()
    .nullable()
    .meta({ examples: [400] }),
  highCents: z
    .number()
    .nullable()
    .meta({ examples: [600] }),
  trendCents: z
    .number()
    .nullable()
    .meta({ examples: [430] }),
  avg1Cents: z
    .number()
    .nullable()
    .meta({ examples: [445] }),
  avg7Cents: z
    .number()
    .nullable()
    .meta({ examples: [460] }),
  avg30Cents: z
    .number()
    .nullable()
    .meta({ examples: [470] }),
  isOverride: z
    .boolean()
    .optional()
    .meta({ examples: [false] }),
  groupId: z
    .number()
    .optional()
    .meta({ examples: [23_482] }),
  groupName: z
    .string()
    .optional()
    .meta({ examples: ["Origins"] }),
  /** Drives the suggestion scorer: `basic` penalises promo/special printings, `special` prefers them. */
  groupKind: groupKindEnum.optional().meta({ examples: ["basic"] }),
  /** When set, the suggester only proposes printings whose `setId` (slug) matches. */
  groupSetSlug: z
    .string()
    .nullable()
    .optional()
    .meta({ examples: [null] }),
});

const marketplaceAssignmentResponseSchema = z.object({
  externalId: z.number().meta({ examples: [748_215] }),
  printingId: z.string().meta({ examples: ["019cfc3b-03d3-7dac-86c9-27900cd43727"] }),
  finish: z.string().meta({ examples: ["foil"] }),
  language: z
    .string()
    .nullable()
    .meta({ examples: ["EN"] }),
});

const unifiedMappingPrintingResponseSchema = z.object({
  printingId: z.string().meta({ examples: ["019cfc3b-03d3-7dac-86c9-27900cd43727"] }),
  /** Slug of the printing's set, used by the suggester to scope by group.setId. */
  setId: z.string().meta({ examples: ["OGN"] }),
  shortCode: z.string().meta({ examples: ["OGN-202"] }),
  rarity: raritySchema,
  artVariant: artVariantSchema,
  isSigned: z.boolean().meta({ examples: [false] }),
  isOvernumbered: z.boolean().meta({ examples: [false] }),
  markerSlugs: z.array(z.string()).meta({ examples: [[]] }),
  /** The printing's own finish, which may be `metal` / `metal-deluxe` — finishes no marketplace sells. */
  finish: finishSchema,
  /** The printing's physical size; no marketplace exposes this as a SKU dimension. */
  size: cardSizeSchema,
  language: z.string().meta({ examples: ["EN"] }),
  imageUrl: z
    .string()
    .nullable()
    .meta({ examples: [null] }),
  tcgExternalId: z
    .number()
    .nullable()
    .meta({ examples: [582_391] }),
  cmExternalId: z
    .number()
    .nullable()
    .meta({ examples: [748_215] }),
  ctExternalId: z
    .number()
    .nullable()
    .meta({ examples: [null] }),
});

const assignableCardResponseSchema = z.object({
  cardId: z.string().meta({ examples: ["019cfc3b-0389-744b-837c-792fd586300e"] }),
  cardSlug: z.string().meta({ examples: ["jinx-rebel"] }),
  cardName: z.string().meta({ examples: ["Jinx, Rebel"] }),
  setName: z.string().meta({ examples: ["Origins"] }),
  /** Short codes of this card's printings (first one, sorted, is shown in the assign dropdown). */
  shortCodes: z.array(z.string()).meta({ examples: [["OGN-202"]] }),
});

const unifiedMappingMarketplaceSchema = z.object({
  stagedProducts: z.array(stagedProductResponseSchema),
  assignedProducts: z.array(stagedProductResponseSchema),
  assignments: z.array(marketplaceAssignmentResponseSchema),
});

export const unifiedMappingGroupResponseSchema = z.object({
  cardId: z.string().meta({ examples: ["019cfc3b-0389-744b-837c-792fd586300e"] }),
  cardSlug: z.string().meta({ examples: ["jinx-rebel"] }),
  cardName: z.string().meta({ examples: ["Jinx, Rebel"] }),
  superTypes: z.array(superTypeSchema).meta({ examples: [["Champion"]] }),
  domains: z.array(domainSchema).meta({ examples: [["Chaos"]] }),
  energy: z
    .number()
    .nullable()
    .meta({ examples: [5] }),
  might: z
    .number()
    .nullable()
    .meta({ examples: [5] }),
  setId: z.string().meta({ examples: ["019cfc3b-0369-7890-a450-7859471cc3f6"] }),
  setName: z.string().meta({ examples: ["Origins"] }),
  printings: z.array(unifiedMappingPrintingResponseSchema),
  primaryShortCode: z.string().meta({ examples: ["OGN-202"] }),
  tcgplayer: unifiedMappingMarketplaceSchema,
  cardmarket: unifiedMappingMarketplaceSchema,
  cardtrader: unifiedMappingMarketplaceSchema,
});

export const unifiedMappingsResponseSchema = z.object({
  groups: z.array(unifiedMappingGroupResponseSchema),
  unmatchedProducts: z.object({
    tcgplayer: z.array(stagedProductResponseSchema),
    cardmarket: z.array(stagedProductResponseSchema),
    cardtrader: z.array(stagedProductResponseSchema),
  }),
  allCards: z.array(assignableCardResponseSchema),
});

/** Single-card variant of {@link unifiedMappingsResponseSchema}. */
export const unifiedMappingsCardResponseSchema = z.object({
  /** Null when the card has no printings or no marketplace activity. */
  group: unifiedMappingGroupResponseSchema.nullable(),
  allCards: z.array(assignableCardResponseSchema),
});

const TAG = "Admin - Mappings";

const MM = "/api/admin/v1/marketplace-mappings";

const saveMappingsBody = z.object({
  mappings: z.array(
    z.object({
      printingId: z.uuid(),
      externalId: z.number(),
      // The marketplace's own view of the SKU finish — always `normal` / `foil`.
      finish: z.string(),
      // `null` for marketplaces that don't expose language as a SKU dimension (CM/TCG).
      language: z.string().nullable(),
    }),
  ),
});

const saveMappingsResult = z.object({
  saved: z.number(),
  skipped: z.array(z.object({ externalId: z.number(), reason: z.string() })),
});

/** `save` and `unmap` use detailed input structure: oRPC compact mode does not read query params. */
export const adminUnifiedMappingsContract = {
  list: authedRoute
    .route({ method: "GET", path: MM, tags: [TAG] })
    .output(unifiedMappingsResponseSchema),
  card: authedRoute
    .route({ method: "GET", path: `${MM}/card/{cardId}`, tags: [TAG] })
    .input(z.object({ cardId: z.string() }))
    .output(unifiedMappingsCardResponseSchema),
  save: authedRoute
    .route({ method: "POST", path: MM, tags: [TAG], inputStructure: "detailed" })
    .input(z.object({ query: z.object({ marketplace: marketplaceEnum }), body: saveMappingsBody }))
    .output(saveMappingsResult),
  unmap: authedRoute
    .route({
      method: "DELETE",
      path: MM,
      tags: [TAG],
      successStatus: 204,
      inputStructure: "detailed",
    })
    .input(
      z.object({
        query: z.object({
          marketplace: marketplaceEnum,
          printingId: z.uuid(),
          externalId: z.coerce.number().int(),
          finish: z.string(),
          language: z.string().optional(),
        }),
      }),
    ),
};

export type AdminUnifiedMappingsContract = typeof adminUnifiedMappingsContract;
export type UnifiedMappingsResponse = z.infer<typeof unifiedMappingsResponseSchema>;
export type UnifiedMappingsCardResponse = z.infer<typeof unifiedMappingsCardResponseSchema>;
