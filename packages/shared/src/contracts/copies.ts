import {
  copyLinkSchema,
  copyListResponseSchema,
  copyResponseSchema,
} from "@openrift/shared/response-schemas";
import { copiesQuerySchema } from "@openrift/shared/schemas";
import { z } from "zod";

import { apiKeyScope, authedRoute } from "./_base.js";
import {
  cancelTradeIdsField,
  tradeCancelConflictDataSchema,
  tradeCancelConflictError,
} from "./fields.js";

// Field pairing mirrors the `copies` table check constraints.
const copyMetadataInputShape = {
  condition: z.string().max(50).nullish(),
  grader: z.string().max(50).nullish(),
  grade: z.number().min(1).max(10).multipleOf(0.5).nullish(),
  notesPublic: z.string().max(2000).nullish(),
  notesPrivate: z.string().max(2000).nullish(),
  isAltered: z.boolean().optional(),
  links: z.array(copyLinkSchema).max(10).optional(),
};

const unset = (value: unknown): boolean => value === null || value === undefined;

const metadataConsistent = (value: {
  condition?: string | null;
  grader?: string | null;
  grade?: number | null;
}) => unset(value.grader) === unset(value.grade) && (unset(value.condition) || unset(value.grader));

const METADATA_CONSISTENCY_MESSAGE =
  "grader and grade must be set together, and a graded copy cannot also carry a condition";

export const MAX_COPIES_PER_ADD = 500;

export const MAX_COPIES_PER_REQUEST = 500;

export const addCopiesSchema = z.object({
  batchId: z.uuid().optional(),
  copies: z
    .array(
      z
        .object({
          id: z.uuid().optional(),
          printingId: z.uuid(),
          collectionId: z.uuid().optional(),
          ...copyMetadataInputShape,
        })
        .refine(metadataConsistent, METADATA_CONSISTENCY_MESSAGE),
    )
    .min(1)
    .max(MAX_COPIES_PER_ADD)
    .superRefine((copies, ctx) => {
      const seen = new Set<string>();
      for (const [index, copy] of copies.entries()) {
        if (copy.id === undefined) {
          continue;
        }
        if (seen.has(copy.id)) {
          ctx.addIssue({
            code: "custom",
            message: "Duplicate copy id in one request",
            path: [index, "id"],
          });
        }
        seen.add(copy.id);
      }
    }),
});

// Absent keys stay untouched; explicit nulls clear.
export const copyMetadataPatchSchema = z
  .object(copyMetadataInputShape)
  .refine(metadataConsistent, METADATA_CONSISTENCY_MESSAGE);

export const updateCopiesSchema = z.object({
  copyIds: z.array(z.uuid()).min(1).max(MAX_COPIES_PER_REQUEST),
  patch: copyMetadataPatchSchema,
});

export const MAX_COPIES_PER_TRADE_CANCEL_CHECK = 10_000;

export const moveCopiesSchema = z.object({
  copyIds: z.array(z.uuid()).min(1).max(MAX_COPIES_PER_REQUEST),
  toCollectionId: z.uuid(),
  cancelTradeIds: cancelTradeIdsField,
});

export const disposeCopiesSchema = z.object({
  copyIds: z.array(z.uuid()).min(1).max(MAX_COPIES_PER_REQUEST),
  cancelTradeIds: cancelTradeIdsField,
});

const checkedCopyIdsField = z.array(z.uuid()).min(1).max(MAX_COPIES_PER_TRADE_CANCEL_CHECK);

export const moveCopiesTradeCancelsSchema = z.object({
  copyIds: checkedCopyIdsField,
  toCollectionId: z.uuid(),
});

export const disposeCopiesTradeCancelsSchema = z.object({ copyIds: checkedCopyIdsField });

export const copyListMembershipsSchema = z.object({
  copyIds: z.array(z.uuid()).min(1).max(500),
  excludeListId: z.uuid().optional(),
});

export const copyAddResponseSchema = z.object({ items: z.array(copyResponseSchema) });

export const copyListMembershipsResponseSchema = z.object({
  lists: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      copyCount: z.number().int().nonnegative(),
    }),
  ),
  copiesOnAnyList: z.number().int().nonnegative(),
});

export const copiesContract = {
  list: authedRoute
    .meta(apiKeyScope("collection:read", { documented: true }))
    .route({
      operationId: "listCopies",
      summary: "All your copies",
      description:
        "Every copy across your collections, paged. Pass `nextCursor` back as `cursor` until it is null. Each copy names its `printingId`; resolve it against `/catalog`.",
      method: "GET",
      path: "/api/v1/copies",
      tags: ["Copies"],
    })
    .input(copiesQuerySchema)
    .output(copyListResponseSchema),
  add: authedRoute
    .meta(apiKeyScope("collection:write", { documented: true }))
    .route({
      operationId: "addCopies",
      summary: "Add copies",
      description:
        "Adds up to 500 copies in one call, one entry per physical card. Find a `printingId` with `GET /api/v1/search?q=OGN-202&unique=prints`, which lists every printing of that card number with its finish and language. Without `collectionId` a copy lands in your Inbox.",
      method: "POST",
      path: "/api/v1/copies",
      tags: ["Copies"],
      successStatus: 201,
    })
    .input(addCopiesSchema)
    .errors({
      BAD_REQUEST: { message: "One or more printings do not exist" },
      CONFLICT: { message: "One or more copy ids already belong to someone else" },
    })
    .output(copyAddResponseSchema),
  move: authedRoute
    .meta(apiKeyScope("collection:write", { documented: true }))
    .route({
      operationId: "moveCopies",
      summary: "Move copies",
      description:
        "Moves copies into another collection you can access. Answers `409` when a copy is promised in an open trade; resolve that in the app.",
      method: "POST",
      path: "/api/v1/copies/move",
      tags: ["Copies"],
      successStatus: 204,
    })
    .errors({
      NOT_FOUND: { message: "Target collection or copies not found" },
      CONFLICT: tradeCancelConflictError,
    })
    .input(moveCopiesSchema),
  moveTradeCancels: authedRoute
    .route({ method: "POST", path: "/api/v1/copies/trade-cancels/move", tags: ["Copies"] })
    .errors({ NOT_FOUND: { message: "Target collection or copies not found" } })
    .input(moveCopiesTradeCancelsSchema)
    .output(tradeCancelConflictDataSchema),
  update: authedRoute
    .meta(apiKeyScope("collection:write", { documented: true }))
    .route({
      operationId: "updateCopies",
      summary: "Edit copy details",
      description:
        "Sets condition, grading, notes, altered flag or links on several copies at once. Omitted fields stay as they are; `null` clears one. A graded copy carries no condition.",
      method: "POST",
      path: "/api/v1/copies/update",
      tags: ["Copies"],
      successStatus: 204,
    })
    .errors({
      NOT_FOUND: { message: "One or more copies not found" },
      BAD_REQUEST: { message: "Unknown condition or grader" },
    })
    .input(updateCopiesSchema),
  dispose: authedRoute
    .meta(apiKeyScope("collection:write", { documented: true }))
    .route({
      operationId: "removeCopies",
      summary: "Remove copies",
      description:
        "Removes copies from your collection, for cards you sold, traded away or lost. Answers `409` when a copy is promised in an open trade; resolve that in the app.",
      method: "POST",
      path: "/api/v1/copies/dispose",
      tags: ["Copies"],
      successStatus: 204,
    })
    .errors({
      NOT_FOUND: { message: "One or more copies not found" },
      CONFLICT: tradeCancelConflictError,
    })
    .input(disposeCopiesSchema),
  disposeTradeCancels: authedRoute
    .route({ method: "POST", path: "/api/v1/copies/trade-cancels/dispose", tags: ["Copies"] })
    .errors({ NOT_FOUND: { message: "One or more copies not found" } })
    .input(disposeCopiesTradeCancelsSchema)
    .output(tradeCancelConflictDataSchema),
  listMemberships: authedRoute
    .meta(apiKeyScope("lists:read"))
    .route({ method: "POST", path: "/api/v1/copies/list-memberships", tags: ["Copies"] })
    .input(copyListMembershipsSchema)
    .output(copyListMembershipsResponseSchema),
};

export type CopiesContract = typeof copiesContract;
