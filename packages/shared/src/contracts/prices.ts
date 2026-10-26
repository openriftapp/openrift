import { oc } from "@orpc/contract";
import { z } from "zod";

import { TIME_RANGE_DAYS } from "../types/pricing.js";
import type { TimeRange } from "../types/pricing.js";

// Integer cents in each marketplace's own currency (tcgplayer=USD, the rest EUR, see MARKETPLACE_CURRENCY).
const marketplacePriceMapSchema = z.object({
  tcgplayer: z
    .number()
    .int()
    .optional()
    .meta({ examples: [452], description: "Integer cents (USD)" }),
  cardmarket: z
    .number()
    .int()
    .optional()
    .meta({ examples: [380], description: "Integer cents (EUR)" }),
  cardtrader: z
    .number()
    .int()
    .optional()
    .meta({ examples: [390], description: "Integer cents (EUR)" }),
  cardnexus: z
    .number()
    .int()
    .optional()
    .meta({ examples: [370], description: "Integer cents (EUR)" }),
});

const marketplaceCurrenciesSchema = z
  .object({
    tcgplayer: z.enum(["EUR", "USD"]),
    cardmarket: z.enum(["EUR", "USD"]),
    cardtrader: z.enum(["EUR", "USD"]),
    cardnexus: z.enum(["EUR", "USD"]),
  })
  .meta({
    examples: [{ tcgplayer: "USD", cardmarket: "EUR", cardtrader: "EUR", cardnexus: "EUR" }],
  });

export const pricesResponseSchema = z.object({
  prices: z.record(z.string(), marketplacePriceMapSchema).meta({
    description: "Keyed by printing id. A marketplace is absent when it has no price.",
    examples: [
      {
        "019cfc3b-03d3-7dac-86c9-27900cd43727": {
          tcgplayer: 452,
          cardmarket: 380,
          cardtrader: 390,
          cardnexus: 370,
        },
      },
    ],
  }),
  currencies: marketplaceCurrenciesSchema,
});

export const tcgplayerSnapshotSchema = z.object({
  date: z.string().meta({ examples: ["2026-04-01"], description: "Date-only (YYYY-MM-DD), USD" }),
  market: z
    .number()
    .int()
    .meta({ examples: [452], description: "Integer cents (USD)" }),
  low: z
    .number()
    .int()
    .nullable()
    .meta({ examples: [325], description: "Integer cents (USD)" }),
});

export const cardmarketSnapshotSchema = z.object({
  date: z.string().meta({ examples: ["2026-04-01"], description: "Date-only (YYYY-MM-DD), EUR" }),
  market: z
    .number()
    .int()
    .meta({ examples: [380], description: "Integer cents (EUR)" }),
  low: z
    .number()
    .int()
    .nullable()
    .meta({ examples: [250], description: "Integer cents (EUR)" }),
});

export const cardtraderSnapshotSchema = z.object({
  date: z.string().meta({ examples: ["2026-04-01"], description: "Date-only (YYYY-MM-DD), EUR" }),
  zeroLow: z
    .number()
    .int()
    .nullable()
    .meta({ examples: [420], description: "Integer cents (EUR)" }),
  low: z
    .number()
    .int()
    .nullable()
    .meta({ examples: [390], description: "Integer cents (EUR)" }),
});

export const cardnexusSnapshotSchema = z.object({
  date: z.string().meta({ examples: ["2026-04-01"], description: "Date-only (YYYY-MM-DD), EUR" }),
  low: z
    .number()
    .int()
    .nullable()
    .meta({ examples: [370], description: "Integer cents (EUR)" }),
});

export const marketplaceLinkSchema = z.object({
  available: z.boolean().meta({ examples: [true] }),
  productId: z
    .number()
    .nullable()
    .meta({ examples: [582_391], description: "The marketplace's own product id" }),
  url: z
    .string()
    .nullable()
    .meta({
      examples: [
        "https://partner.tcgplayer.com/openrift?u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F582391",
      ],
      description: "Product page link, with OpenRift's referral code where the marketplace has one",
    }),
});

const currencyFieldSchema = z.enum(["EUR", "USD"]);

const currentPriceSchema = z
  .number()
  .int()
  .nullable()
  .meta({ examples: [452], description: "Today's price in integer cents, null when unpriced" });

export const printingPricesResponseSchema = z.object({
  tcgplayer: marketplaceLinkSchema.extend({
    currency: currencyFieldSchema,
    price: currentPriceSchema,
    snapshots: z.array(tcgplayerSnapshotSchema),
  }),
  cardmarket: marketplaceLinkSchema.extend({
    currency: currencyFieldSchema,
    price: currentPriceSchema,
    snapshots: z.array(cardmarketSnapshotSchema),
  }),
  cardtrader: marketplaceLinkSchema.extend({
    currency: currencyFieldSchema,
    price: currentPriceSchema,
    snapshots: z.array(cardtraderSnapshotSchema),
  }),
  cardnexus: marketplaceLinkSchema.extend({
    currency: currencyFieldSchema,
    price: currentPriceSchema,
    snapshots: z.array(cardnexusSnapshotSchema),
  }),
});

export const marketplaceLinksResponseSchema = z.object({
  links: z
    .record(
      z.string(),
      z.object({
        tcgplayer: marketplaceLinkSchema,
        cardmarket: marketplaceLinkSchema,
        cardtrader: marketplaceLinkSchema,
        cardnexus: marketplaceLinkSchema,
      }),
    )
    .meta({
      description: "Keyed by printing id.",
      examples: [
        {
          "019cfc3b-03d3-7dac-86c9-27900cd43727": {
            tcgplayer: {
              available: true,
              productId: 582_391,
              url: "https://partner.tcgplayer.com/openrift?u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F582391",
            },
            cardmarket: {
              available: true,
              productId: 748_215,
              url: "https://www.cardmarket.com/en/Riftbound/Products?idProduct=748215&language=1",
            },
            cardtrader: { available: false, productId: null, url: null },
            cardnexus: {
              available: true,
              productId: 151_160,
              url: "https://af.cardnexus.link/7018965/cn/151160",
            },
          },
        },
      ],
    }),
});

const TAG = "Prices";

const MARKETPLACE_LINKS_MAX_PRINTINGS = 200;

const rangeQuerySchema = z.object({
  range: z
    .enum(Object.keys(TIME_RANGE_DAYS) as [TimeRange, ...TimeRange[]])
    .default("30d")
    .meta({ description: "How far back `snapshots` reach." }),
});

const marketplaceLinksQuerySchema = z.object({
  printings: z
    .string()
    .optional()
    .meta({
      description: `Comma-separated printing ids, at most ${MARKETPLACE_LINKS_MAX_PRINTINGS}. Omit it for every printing that has a marketplace product.`,
      examples: ["019cfc3b-03d3-7dac-86c9-27900cd43727"],
    })
    .transform((value, ctx) => {
      if (value === undefined) {
        return value;
      }
      const ids = value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        ctx.addIssue({ code: "custom", message: "printings must not be empty" });
        return z.NEVER;
      }
      if (ids.length > MARKETPLACE_LINKS_MAX_PRINTINGS) {
        ctx.addIssue({
          code: "custom",
          message: `printings must be at most ${MARKETPLACE_LINKS_MAX_PRINTINGS} ids`,
        });
        return z.NEVER;
      }
      const uuid = z.uuid();
      for (const id of ids) {
        const parsed = uuid.safeParse(id);
        if (!parsed.success) {
          ctx.addIssue({ code: "custom", message: `invalid uuid: ${id}` });
          return z.NEVER;
        }
      }
      return [...new Set(ids)];
    }),
});

const printingIdParam = z.uuid().meta({
  description: "A printing id from `/catalog`.",
  examples: ["019cfc3b-03d3-7dac-86c9-27900cd43727"],
});

// The static `links` is declared before `{printingId}` so the oRPC router
// resolves it ahead of the param route.
export const pricesContract = {
  prices: oc
    .route({
      method: "GET",
      path: "/api/v1/prices",
      tags: [TAG],
      operationId: "listPrices",
      summary: "Today's price of every printing",
      description:
        "One price per marketplace per printing, in integer cents of that marketplace's currency (see `currencies`). TCGplayer's market price, the lowest listing on Cardmarket and CardNexus, and the lowest CardTrader Zero listing on CardTrader. Updated once a day.",
    })
    .meta({ auth: "public", developerApi: true, cache: "long", etag: true })
    .output(pricesResponseSchema),

  links: oc
    .route({
      method: "GET",
      path: "/api/v1/prices/links",
      tags: [TAG],
      operationId: "listMarketplaceLinks",
      summary: "Store links per printing",
      description:
        "Each marketplace's product id and a ready-made product page link for the given printings, or for every printing when `printings` is omitted. Links to TCGplayer, CardTrader and CardNexus carry OpenRift's referral code.",
    })
    .meta({ auth: "public", developerApi: true, cache: "long", etag: true })
    .input(marketplaceLinksQuerySchema)
    .output(marketplaceLinksResponseSchema),

  printing: oc
    .route({
      method: "GET",
      path: "/api/v1/prices/{printingId}",
      tags: [TAG],
      operationId: "getPrintingPrices",
      summary: "One printing's prices, links and history",
      description:
        "Today's price, the store link and the daily price history of one printing on every marketplace. A marketplace the printing is not sold on comes back as `available: false` with empty snapshots.",
    })
    .meta({ auth: "public", developerApi: true, cache: "long", etag: true })
    .input(rangeQuerySchema.extend({ printingId: printingIdParam }))
    .errors({ NOT_FOUND: { message: "Printing not found" } })
    .output(printingPricesResponseSchema),
};

export type PricesContract = typeof pricesContract;
