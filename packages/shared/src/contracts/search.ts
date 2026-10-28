import {
  catalogCardResponseValueSchema,
  catalogPrintingResponseValueSchema,
} from "@openrift/shared/contracts/catalog";
import { catalogSetResponseSchema } from "@openrift/shared/response-schemas";
import { oc } from "@orpc/contract";
import { z } from "zod";

const SEARCH_QUERY_MAX_CHARS = 500;
const SEARCH_PAGE_MAX = 200;
export const SEARCH_PAGE_DEFAULT = 100;
const NAME_MAX_CHARS = 200;

export const searchInputSchema = z.object({
  q: z
    .string()
    .min(1)
    .max(SEARCH_QUERY_MAX_CHARS)
    .meta({
      examples: ["t:unit d:fury e<=3"],
      description:
        "The query, in the syntax the site's search box takes (see the Search syntax help article). `order:`, `direction:` and `unique:` inside it set the sort and whether one printing per card is returned. `price`, `owned` and `ctag:` depend on a signed-in viewer and are refused.",
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

export const searchResponseSchema = z.object({
  total: z.number().meta({ description: "Matching printings, or cards with `unique:cards`." }),
  nextCursor: z.string().nullable().meta({ description: "Null on the last page." }),
  printingIds: z.array(z.string()).meta({
    description: "This page's printings in result order. Look each one up in `printings`.",
  }),
  printings: z.record(z.string(), catalogPrintingResponseValueSchema),
  cards: z.record(z.string(), catalogCardResponseValueSchema),
  sets: z
    .array(catalogSetResponseSchema)
    .meta({ description: "The sets this page's printings belong to." }),
});

const searchDiagnosticSchema = z.object({
  code: z.string().meta({ examples: ["unknownValue"] }),
  severity: z.enum(["warning", "error"]),
  start: z.number().meta({ description: "Character offset into `q` where the problem starts." }),
  end: z.number().meta({ description: "Character offset where it ends, exclusive." }),
  key: z.string().optional(),
  value: z.string().optional(),
});

export const searchContract = {
  search: oc
    .route({
      method: "GET",
      path: "/api/v1/search",
      tags: ["Search"],
      operationId: "searchCards",
      summary: "Search cards with a query",
      description:
        "Runs a search query against the catalog and returns one page of printings in the `/catalog` shape, with the cards and sets they reference. Bare words match card names, and a word shaped like a card number (`OGN-202`) also matches card numbers. Other fields need their key, like `o:` for card text. Results are one printing per card. Add `unique:prints` for every printing, and `prefer:` to choose which printing represents a card. Marker and distribution channel slugs are defined in `/catalog`. A query with an error (an unknown value, a malformed number, a refused key) returns 400 with the problems in `data.diagnostics`.",
    })
    .meta({ auth: "public", developerApi: true, cache: "long", etag: true })
    .errors({
      BAD_REQUEST: {
        message: "The query has errors",
        data: z.object({ diagnostics: z.array(searchDiagnosticSchema) }),
      },
    })
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
        "Every printing of one card, in the `/api/v1/search` shape. `exact` matches a full card name (case, accents and punctuation ignored); `fuzzy` returns the best match for a partial or misspelled name, the way the Discord bot resolves names. Pass one of the two.",
    })
    .meta({ auth: "public", developerApi: true, cache: "long", etag: true })
    .errors({ NOT_FOUND: { message: "No card matches that name" } })
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
    .errors({
      BAD_REQUEST: {
        message: "The query has errors",
        data: z.object({ diagnostics: z.array(searchDiagnosticSchema) }),
      },
      NOT_FOUND: { message: "No card matches the query" },
    })
    .input(z.object({ q: searchInputSchema.shape.q.optional() }))
    .output(searchResponseSchema),
};

export type SearchContract = typeof searchContract;

export type SearchResponse = z.infer<typeof searchResponseSchema>;
