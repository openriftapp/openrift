import {
  catalogCardResponseValueSchema,
  catalogPrintingResponseValueSchema,
} from "@openrift/shared/contracts/catalog";
import { catalogSetResponseSchema } from "@openrift/shared/response-schemas";
import { DIRECTION_VALUES, ORDER_VALUES, UNIQUE_VALUES } from "@openrift/shared/search-query/keys";
import { oc } from "@orpc/contract";
import { z } from "zod";

const SEARCH_QUERY_MAX_CHARS = 1000;
const SEARCH_PAGE_MAX = 200;
export const SEARCH_PAGE_DEFAULT = 100;
const NAME_MAX_CHARS = 200;

const searchQuerySchema = z
  .string()
  .min(1)
  .max(SEARCH_QUERY_MAX_CHARS)
  .meta({
    examples: ["t:unit d:fury e<=3"],
    description:
      "The query, in the syntax the site's search box takes (see the Search syntax help article). Printings are English unless the query has `lang:`; `lang:any` searches every language. `price`, `owned` and `ctag:` depend on a signed-in viewer and are refused.",
  });

export const searchInputSchema = z.object({
  q: searchQuerySchema,
  unique: z.enum(UNIQUE_VALUES).optional().meta({
    description:
      "`cards` (default) returns one printing per card, `prints` every printing, `art` one printing per illustration. `unique:` in the query wins.",
  }),
  order: z.enum(ORDER_VALUES).optional().meta({
    description:
      "Sort order, `name` when omitted. `price` is an alias of `usd`. `order:` in the query wins.",
  }),
  dir: z.enum(DIRECTION_VALUES).optional().meta({
    description:
      "`auto` (default) sorts `usd`, `eur` and `released` highest first and everything else A to Z. `direction:` in the query wins.",
  }),
  cursor: z.string().optional().meta({
    description: "The `nextCursor` of the previous page. Omit it for the first page.",
  }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SEARCH_PAGE_MAX)
    .optional()
    .meta({ description: `Results per page, ${SEARCH_PAGE_DEFAULT} when omitted.` }),
});

const warningsSchema = z.array(z.string()).meta({
  description:
    "Parts of the query that were ignored, as sentences. An unknown key or value is left out and the rest of the query still runs.",
});

export const searchResponseSchema = z.object({
  total: z
    .number()
    .meta({ description: "Matching printings, or cards with `unique:cards`, or illustrations." }),
  nextCursor: z.string().nullable().meta({ description: "Null on the last page." }),
  printingIds: z.array(z.string()).meta({
    description: "This page's printings in result order. Look each one up in `printings`.",
  }),
  printings: z.record(z.string(), catalogPrintingResponseValueSchema),
  cards: z.record(z.string(), catalogCardResponseValueSchema),
  sets: z
    .array(catalogSetResponseSchema)
    .meta({ description: "The sets this page's printings belong to." }),
  warnings: warningsSchema,
});

const searchDiagnosticSchema = z.object({
  code: z.string().meta({ examples: ["badValue"] }),
  severity: z.enum(["warning", "error"]),
  start: z.number().meta({ description: "Character offset into `q` where the problem starts." }),
  end: z.number().meta({ description: "Character offset where it ends, exclusive." }),
  key: z.string().optional(),
  value: z.string().optional(),
});

const searchErrors = {
  BAD_REQUEST: {
    message: "The query has errors",
    data: z.object({ diagnostics: z.array(searchDiagnosticSchema), warnings: warningsSchema }),
  },
  NOT_FOUND: {
    message: "Your query didn't match any cards",
    data: z.object({ warnings: warningsSchema }),
  },
};

export const searchContract = {
  search: oc
    .route({
      method: "GET",
      path: "/api/v1/search",
      tags: ["Search"],
      operationId: "searchCards",
      summary: "Search cards with a query",
      description:
        "Runs a search query against the catalog and returns one page of printings in the `/catalog` shape, with the cards and sets they reference. Bare words match card names, and a word shaped like a card number (`OGN-202`) also matches card numbers. Other fields need their key, like `o:` for card text. An unknown key or value is ignored and named in `warnings`. A query that matches nothing returns 404. A query with an error (a malformed number, a refused key, nothing left after ignoring) returns 400 with the problems in `data.diagnostics` and `data.warnings`, and the first one in `message`.",
    })
    .meta({ auth: "public", developerApi: true, cache: "long", etag: true })
    .errors(searchErrors)
    .input(searchInputSchema)
    .output(searchResponseSchema),
  named: oc
    .route({
      method: "GET",
      path: "/api/v1/search/named",
      tags: ["Search"],
      operationId: "getNamedCard",
      summary: "One card by name",
      description:
        "Every printing of one card, in the `/api/v1/search` shape. `exact` matches a full card name (case, accents and punctuation ignored); `fuzzy` matches a partial or misspelled name, and returns 404 with `data.type` `ambiguous` when more than one card fits equally well. Pass one of the two. `set` limits the printings to one set, by code or name.",
    })
    .meta({ auth: "public", developerApi: true, cache: "long", etag: true })
    .errors({
      NOT_FOUND: {
        message: "No card matches that name",
        data: z.object({ type: z.enum(["not_found", "ambiguous"]) }),
      },
    })
    .input(
      z
        .object({
          exact: z
            .string()
            .min(1)
            .max(NAME_MAX_CHARS)
            .optional()
            .meta({ examples: ["Jinx, Rebel"] }),
          fuzzy: z
            .string()
            .min(1)
            .max(NAME_MAX_CHARS)
            .optional()
            .meta({ examples: ["jinx reb"] }),
          set: z
            .string()
            .min(1)
            .max(NAME_MAX_CHARS)
            .optional()
            .meta({ examples: ["OGN"] }),
        })
        .refine((input) => (input.exact === undefined) !== (input.fuzzy === undefined), {
          message: "Pass exactly one of exact or fuzzy.",
        }),
    )
    .output(searchResponseSchema),
  random: oc
    .route({
      method: "GET",
      path: "/api/v1/search/random",
      tags: ["Search"],
      operationId: "getRandomCard",
      summary: "One random card",
      description:
        "One random card, as one printing in the `/api/v1/search` shape, optionally limited by a search query in the same syntax.",
    })
    .meta({ auth: "public", developerApi: true, cache: "revalidate" })
    .errors(searchErrors)
    .input(z.object({ q: searchQuerySchema.optional() }))
    .output(searchResponseSchema),
};

export type SearchContract = typeof searchContract;

export type SearchResponse = z.infer<typeof searchResponseSchema>;
