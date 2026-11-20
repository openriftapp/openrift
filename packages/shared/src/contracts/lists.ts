import {
  currencyResponseSchema,
  listEntryBaseShape,
  listEntryDetailResponseSchema,
  LIST_INTENTS,
  LIST_KINDS,
  listIntentResponseSchema,
  listKindResponseSchema,
  tradePreferenceSchema,
} from "@openrift/shared/response-schemas";
import {
  currencySchema,
  idParamSchema,
  listEntryFieldRules,
  listEntryInputShape,
  listRuleCombineSchema,
  listRulesSchema,
  oneListEntryTarget,
  ruleCombineMatchesKind,
  ruleKindForListKind,
  tradePreferenceInputSchema,
  withParams,
} from "@openrift/shared/schemas";
import { z } from "zod";

import { apiKeyScope, authedRoute } from "./_base.js";
import {
  cancelTradeIdsField,
  nameField,
  shareStateResponseSchema,
  tradeCancelConflictError,
} from "./fields.js";

const listIntentSchema = z.enum(LIST_INTENTS);

const listKindSchema = z.enum(LIST_KINDS);

/** Mirrors the chk_lists_intent_kind DB constraint. */
const isAllowedIntentKind = (
  intent: (typeof LIST_INTENTS)[number],
  kind: (typeof LIST_KINDS)[number],
): boolean => {
  if (intent === "wish") {
    return kind === "card" || kind === "printing";
  }
  if (intent === "trade") {
    return kind === "copy";
  }
  return true;
};

export const idAndItemIdParamSchema = z.object({ id: z.uuid(), itemId: z.uuid() });

export const listIntentQuerySchema = z.object({
  intent: listIntentSchema.optional(),
});

/**
 * The route layer drops trade defaults for `organize` lists; the DB CHECK
 * constraint also rejects non-null values there.
 */
export const createListSchema = z
  .object({
    name: nameField(200),
    intent: listIntentSchema,
    kind: listKindSchema,
    tradeDefaults: tradePreferenceInputSchema.optional(),
    currency: currencySchema.nullable().optional(),
    rules: listRulesSchema.optional(),
    ruleCombine: listRuleCombineSchema.nullable().optional(),
  })
  .refine((data) => isAllowedIntentKind(data.intent, data.kind), {
    message:
      "Disallowed intent/kind combo. Wish: card|printing. Trade: copy. Organize: card|printing|copy.",
  })
  .refine(
    (data) =>
      data.intent !== "organize" ||
      ((data.tradeDefaults === undefined ||
        (data.tradeDefaults.pricePref === null && data.tradeDefaults.tradeType === null)) &&
        (data.currency === undefined || data.currency === null)),
    { message: "organize lists cannot carry trade defaults or a currency" },
  )
  .refine(
    (data) => (data.rules ?? []).every((rule) => rule.kind === ruleKindForListKind(data.kind)),
    { message: "rule kind must match the list kind" },
  )
  .refine(
    (data) =>
      data.ruleCombine === null ||
      data.ruleCombine === undefined ||
      ruleCombineMatchesKind(data.ruleCombine, data.kind),
    { message: "rule combine mode must match the list kind" },
  );

export const updateListSchema = z.object({
  name: nameField(200).optional(),
  sidebarHidden: z.boolean().optional(),
  tradeDefaults: tradePreferenceInputSchema.optional(),
  currency: currencySchema.nullable().optional(),
  rules: listRulesSchema.optional(),
  ruleCombine: listRuleCombineSchema.nullable().optional(),
  expectedRulesVersion: z.number().int().nonnegative().optional(),
  cancelTradeIds: cancelTradeIdsField,
});

export const updateListInputSchema = withParams(idParamSchema, updateListSchema).refine(
  (input) =>
    (input.rules === undefined && input.ruleCombine === undefined) ||
    input.expectedRulesVersion !== undefined,
  { message: "A rules change needs the rules version it was made from" },
);

/** The one id matching the list kind: a card or printing to exclude, or a copy to keep. */
const dropFromListRulesSchema = z.object({
  cardId: z.uuid().optional(),
  printingId: z.uuid().optional(),
  copyId: z.uuid().optional(),
  cancelTradeIds: cancelTradeIdsField,
});

/** Server renumbers sort_order to match orderedIds, scoped to one intent bucket. */
export const reorderListsSchema = z.object({
  intent: listIntentSchema,
  orderedIds: z.array(z.uuid()).min(1).max(500),
});

export const updateListEntrySchema = z.object({
  quantity: listEntryFieldRules.quantity.optional(),
  quantityDelta: listEntryFieldRules.quantityDelta.optional(),
  tradeOverride: tradePreferenceInputSchema.optional(),
});

export const updateListEntryInputSchema = withParams(
  idAndItemIdParamSchema,
  updateListEntrySchema,
).refine((input) => input.quantity === undefined || input.quantityDelta === undefined, {
  message: "Send a quantity or a step, not both",
});

export const bulkCreateListEntriesSchema = z.object({
  entries: z
    .array(
      z.object(listEntryInputShape).refine(oneListEntryTarget, {
        message: "Exactly one of cardId, printingId, or copyId must be provided",
      }),
    )
    .min(1)
    .max(500),
});

export const bulkAddCopiesToListSchema = z.object({
  copyIds: z.array(z.uuid()).min(1).max(500),
  cardId: z.uuid().optional(),
});

/**
 * Destination list must match the source's kind and intent: a different kind
 * would reshape every entry, a different intent would silently repurpose them.
 */
/** `resolutions` carries the user's picks when the destination kind is wider
 * than the source: card → printing needs a printing, anything → copy needs copies. */
export const moveListEntriesSchema = z.object({
  toListId: z.uuid(),
  entryIds: z.array(z.uuid()).min(1).max(500),
  /** `copy` leaves the source entries in place. */
  mode: z.enum(["move", "copy"]).optional(),
  resolutions: z
    .array(
      z.object({
        entryId: z.uuid(),
        printingId: z.uuid().optional(),
        cardId: z.uuid().optional(),
        copyIds: z.array(z.uuid()).min(1).max(100).optional(),
      }),
    )
    .max(500)
    .optional(),
  cancelTradeIds: cancelTradeIdsField,
});

export type MoveListEntriesResolution = NonNullable<
  z.infer<typeof moveListEntriesSchema>["resolutions"]
>[number];

export const bulkDeleteListEntriesSchema = z.object({
  entryIds: z.array(z.uuid()).min(1).max(500),
  cancelTradeIds: cancelTradeIdsField,
});

export const decrementListEntriesSchema = z.object({
  entries: z
    .array(z.object({ entryId: z.uuid(), by: listEntryFieldRules.quantity }))
    .min(1)
    .max(500),
  cancelTradeIds: cancelTradeIdsField,
});

const listResponseShape = {
  id: z.string(),
  name: z.string(),
  intent: listIntentResponseSchema,
  kind: listKindResponseSchema,
  entryCount: z.number().int().nonnegative(),
  isPublic: z.boolean(),
  shareToken: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tradeDefaults: tradePreferenceSchema,
  currency: currencyResponseSchema.nullable(),
  hasRule: z.boolean(),
  sidebarHidden: z.boolean(),
};

export const listResponseSchema = z.object(listResponseShape);

const listRulesStateShape = {
  rules: listRulesSchema,
  ruleCombine: listRuleCombineSchema.nullable(),
  rulesVersion: z.number().int().nonnegative(),
};

export const listDetailListResponseSchema = z.object({
  ...listResponseShape,
  ...listRulesStateShape,
});

export const listRulesStateSchema = z.object(listRulesStateShape);

export const listListResponseSchema = z.object({ items: z.array(listResponseSchema) });

export const listEntryResponseSchema = z.discriminatedUnion("kind", [
  z.object({ ...listEntryBaseShape, kind: z.literal("card"), cardId: z.string() }),
  z.object({ ...listEntryBaseShape, kind: z.literal("printing"), printingId: z.string() }),
  z.object({ ...listEntryBaseShape, kind: z.literal("copy"), copyId: z.string() }),
]);

export const listDetailResponseSchema = z.object({
  list: listDetailListResponseSchema,
  entries: z.array(listEntryDetailResponseSchema),
});

export const listDetailsResponseSchema = z.object({ items: z.array(listDetailResponseSchema) });

// shareToken is nullable: GET /share reports an owned-but-unshared list as
// null; share always returns a non-null token.
export const listShareResponseSchema = shareStateResponseSchema;

export const listBulkAddResponseSchema = z.object({
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

export const listMoveResponseSchema = z.object({
  moved: z.number().int().nonnegative(),
  merged: z.number().int().nonnegative(),
});

export const listGroupSharesResponseSchema = z.object({
  items: z.array(
    z.object({
      groupId: z.string(),
      groupSlug: z.string(),
      groupName: z.string(),
    }),
  ),
});

const TAG = "Lists";

export const listsContract = {
  list: authedRoute
    .meta(apiKeyScope("lists:read", { documented: true }))
    .route({
      operationId: "listLists",
      summary: "Your wishlists, tradelists and organize lists",
      description:
        "Every list you own. Pass `intent` to get only wishlists, tradelists or organize lists.",
      method: "GET",
      path: "/api/v1/lists",
      tags: [TAG],
    })
    .input(listIntentQuerySchema)
    .output(listListResponseSchema),
  create: authedRoute
    .meta(apiKeyScope("lists:write", { documented: true }))
    .route({
      operationId: "createList",
      summary: "Create a list",
      description:
        "`intent` picks a wishlist (`wish`), tradelist (`trade`) or organize list (`organize`). `kind` sets what an entry points at: a wishlist holds cards or printings, a tradelist holds copies, an organize list holds any of the three.",
      method: "POST",
      path: "/api/v1/lists",
      tags: [TAG],
      successStatus: 201,
    })
    .input(createListSchema)
    .output(listResponseSchema),
  details: authedRoute
    .meta(apiKeyScope("lists:read"))
    .route({ method: "GET", path: "/api/v1/lists/details", tags: [TAG] })
    .input(listIntentQuerySchema)
    .output(listDetailsResponseSchema),
  get: authedRoute
    .meta(apiKeyScope("lists:read", { documented: true }))
    .route({
      operationId: "getList",
      summary: "One list with its entries",
      description: "A list you own, with every entry.",
      method: "GET",
      path: "/api/v1/lists/{id}",
      tags: [TAG],
    })
    .input(idParamSchema)
    .errors({ NOT_FOUND: { message: "List not found" } })
    .output(listDetailResponseSchema),
  update: authedRoute
    .meta(apiKeyScope("lists:write", { documented: true }))
    .route({
      operationId: "updateList",
      summary: "Change a list",
      description:
        "Changes name, trade defaults, currency or rules. Omitted fields stay as they are. Answers `409` when new rules would drop entries backing an open trade; resolve that in the app.",
      method: "PATCH",
      path: "/api/v1/lists/{id}",
      tags: [TAG],
    })
    .input(updateListInputSchema)
    .errors({
      NOT_FOUND: { message: "List not found" },
      BAD_REQUEST: { message: "No fields to update" },
      CONFLICT: tradeCancelConflictError,
      PRECONDITION_FAILED: {
        message: "The list's rules changed since this version",
        data: listRulesStateSchema,
      },
    })
    .output(listResponseSchema),
  dropFromRules: authedRoute
    .meta(apiKeyScope("lists:write"))
    .route({ method: "POST", path: "/api/v1/lists/{id}/rules/drop", tags: [TAG] })
    .input(
      withParams(idParamSchema, dropFromListRulesSchema).refine(oneListEntryTarget, {
        message: "Exactly one of cardId, printingId, or copyId must be provided",
      }),
    )
    .errors({
      NOT_FOUND: { message: "List not found" },
      BAD_REQUEST: { message: "Entry target does not match list kind" },
      CONFLICT: tradeCancelConflictError,
    })
    .output(listResponseSchema),
  remove: authedRoute
    .meta(apiKeyScope("lists:write", { documented: true }))
    .route({
      operationId: "deleteList",
      summary: "Delete a list",
      description:
        "Deletes the list and its entries. The cards and copies it pointed at stay. Answers `409` when the list backs an open trade; resolve that in the app.",
      method: "DELETE",
      path: "/api/v1/lists/{id}",
      tags: [TAG],
      successStatus: 204,
    })
    .errors({ NOT_FOUND: { message: "List not found" }, CONFLICT: tradeCancelConflictError })
    .input(withParams(idParamSchema, { cancelTradeIds: cancelTradeIdsField })),
  createEntry: authedRoute
    .meta(apiKeyScope("lists:write", { documented: true }))
    .route({
      operationId: "addListEntry",
      summary: "Add one entry",
      description:
        "Adds a card, printing or copy to a list. Set exactly one of `cardId`, `printingId` or `copyId`, matching the list's `kind`. `GET /api/v1/search/named?fuzzy=jinx` returns a card's `cardId` and its printings' ids.",
      method: "POST",
      path: "/api/v1/lists/{id}/entries",
      tags: [TAG],
      successStatus: 201,
    })
    .input(withParams(idParamSchema, listEntryInputShape))
    .errors({
      NOT_FOUND: { message: "List or copy not found" },
      BAD_REQUEST: { message: "Entry target does not match list kind" },
      CONFLICT: { message: "That item is already in the list" },
    })
    .output(listEntryResponseSchema),
  bulkCreateEntries: authedRoute
    .meta(apiKeyScope("lists:write", { documented: true }))
    .route({
      operationId: "addListEntries",
      summary: "Add several entries",
      description:
        "Adds many entries in one call, each with exactly one of `cardId`, `printingId` or `copyId`.",
      method: "POST",
      path: "/api/v1/lists/{id}/entries/bulk",
      tags: [TAG],
    })
    .input(withParams(idParamSchema, bulkCreateListEntriesSchema))
    .errors({
      NOT_FOUND: { message: "List not found" },
      BAD_REQUEST: { message: "Entry target does not match list kind" },
    })
    .output(listBulkAddResponseSchema),
  bulkAddFromCopies: authedRoute
    .meta(apiKeyScope("lists:write"))
    .route({ method: "POST", path: "/api/v1/lists/{id}/entries/from-copies", tags: [TAG] })
    .input(withParams(idParamSchema, bulkAddCopiesToListSchema))
    .errors({ NOT_FOUND: { message: "List not found" } })
    .output(listBulkAddResponseSchema),
  moveEntries: authedRoute
    .meta(apiKeyScope("lists:write"))
    .route({ method: "POST", path: "/api/v1/lists/{id}/entries/move", tags: [TAG] })
    .input(withParams(idParamSchema, moveListEntriesSchema))
    .errors({
      NOT_FOUND: { message: "List not found" },
      BAD_REQUEST: { message: "Entries can't be moved to that list" },
      CONFLICT: tradeCancelConflictError,
    })
    .output(listMoveResponseSchema),
  updateEntry: authedRoute
    .meta(apiKeyScope("lists:write", { documented: true }))
    .route({
      operationId: "updateListEntry",
      summary: "Change an entry",
      description: "Changes an entry's quantity or its trade preference.",
      method: "PATCH",
      path: "/api/v1/lists/{id}/entries/{itemId}",
      tags: [TAG],
    })
    .input(updateListEntryInputSchema)
    .errors({
      NOT_FOUND: { message: "Entry not found" },
      BAD_REQUEST: { message: "No fields to update" },
    })
    .output(listEntryResponseSchema),
  removeEntry: authedRoute
    .meta(apiKeyScope("lists:write", { documented: true }))
    .route({
      operationId: "removeListEntry",
      summary: "Remove an entry",
      description:
        "Removes one entry. Answers `409` when it backs an open trade; resolve that in the app.",
      method: "DELETE",
      path: "/api/v1/lists/{id}/entries/{itemId}",
      tags: [TAG],
      successStatus: 204,
    })
    .errors({ NOT_FOUND: { message: "Entry not found" }, CONFLICT: tradeCancelConflictError })
    .input(withParams(idAndItemIdParamSchema, { cancelTradeIds: cancelTradeIdsField })),
  bulkDeleteEntries: authedRoute
    .meta(apiKeyScope("lists:write", { documented: true }))
    .route({
      operationId: "removeListEntries",
      summary: "Remove several entries",
      description:
        "Removes up to 500 entries in one call. Answers `409` when one backs an open trade; resolve that in the app.",
      method: "POST",
      path: "/api/v1/lists/{id}/entries/bulk-delete",
      tags: [TAG],
      successStatus: 204,
    })
    .errors({ NOT_FOUND: { message: "List not found" }, CONFLICT: tradeCancelConflictError })
    .input(withParams(idParamSchema, bulkDeleteListEntriesSchema)),
  decrementEntries: authedRoute
    .meta(apiKeyScope("lists:write"))
    .route({
      method: "POST",
      path: "/api/v1/lists/entries/decrement",
      tags: [TAG],
      successStatus: 204,
    })
    .errors({ CONFLICT: tradeCancelConflictError })
    .input(decrementListEntriesSchema),
  getShare: authedRoute
    .route({ method: "GET", path: "/api/v1/lists/{id}/share", tags: [TAG] })
    .input(idParamSchema)
    .errors({ NOT_FOUND: { message: "List not found" } })
    .output(listShareResponseSchema),
  share: authedRoute
    .route({ method: "POST", path: "/api/v1/lists/{id}/share", tags: [TAG] })
    .input(idParamSchema)
    .errors({ NOT_FOUND: { message: "List not found" } })
    .output(listShareResponseSchema),
  unshare: authedRoute
    .route({ method: "DELETE", path: "/api/v1/lists/{id}/share", tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "List not found" } })
    .input(idParamSchema),
  reorder: authedRoute
    .meta(apiKeyScope("lists:write"))
    .route({ method: "POST", path: "/api/v1/lists/reorder", tags: [TAG], successStatus: 204 })
    .input(reorderListsSchema),
  groupShares: authedRoute
    .route({ method: "GET", path: "/api/v1/lists/{id}/group-shares", tags: [TAG] })
    .input(idParamSchema)
    .errors({ NOT_FOUND: { message: "List not found" } })
    .output(listGroupSharesResponseSchema),
};

export type ListsContract = typeof listsContract;
