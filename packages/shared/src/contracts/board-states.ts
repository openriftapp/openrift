import { boardDocumentSchema } from "@openrift/shared/board-state";
import { idParamSchema, withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "./_base.js";

const rulesVersion = z.string().trim().min(1).max(40);

const boardStateFieldRules = {
  title: z.string().trim().min(1).max(200),
  answer: z.string().max(2000),
  rulesVersion: rulesVersion.nullable(),
};

const RULES_PIN_MESSAGE = "Pin at least one rules version";

export const createBoardStateSchema = z
  .object({
    title: boardStateFieldRules.title,
    answer: boardStateFieldRules.answer.nullish(),
    coreRulesVersion: boardStateFieldRules.rulesVersion,
    tournamentRulesVersion: boardStateFieldRules.rulesVersion,
    document: boardDocumentSchema,
  })
  .refine(
    (input) => input.coreRulesVersion !== null || input.tournamentRulesVersion !== null,
    RULES_PIN_MESSAGE,
  );

export const updateBoardStateSchema = z.object({
  title: boardStateFieldRules.title.optional(),
  answer: boardStateFieldRules.answer.nullish(),
  coreRulesVersion: boardStateFieldRules.rulesVersion.optional(),
  tournamentRulesVersion: boardStateFieldRules.rulesVersion.optional(),
  document: boardDocumentSchema.optional(),
});

export const boardStateResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  answer: z.string().nullable(),
  coreRulesVersion: z.string().nullable(),
  tournamentRulesVersion: z.string().nullable(),
  document: boardDocumentSchema,
  isPublic: z.boolean(),
  shareToken: z.string().nullable(),
  isFeatured: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const boardStateListResponseSchema = z.object({
  items: z.array(boardStateResponseSchema),
});

export const boardStateShareResponseSchema = z.object({
  shareToken: z.string().nullable(),
  isPublic: z.boolean(),
});

const TAG = "Board states";
const NOT_FOUND = { NOT_FOUND: { message: "Board state not found" } };
const INVALID_RULES = {
  BAD_REQUEST: { message: "Unknown rules version" },
};

export const boardStatesContract = {
  list: authedRoute
    .route({ method: "GET", path: "/api/v1/board-states", tags: [TAG] })
    .output(boardStateListResponseSchema),
  get: authedRoute
    .route({ method: "GET", path: "/api/v1/board-states/{id}", tags: [TAG] })
    .input(idParamSchema)
    .errors(NOT_FOUND)
    .output(boardStateResponseSchema),
  create: authedRoute
    .route({ method: "POST", path: "/api/v1/board-states", tags: [TAG], successStatus: 201 })
    .input(createBoardStateSchema)
    .errors(INVALID_RULES)
    .output(boardStateResponseSchema),
  update: authedRoute
    .route({ method: "PATCH", path: "/api/v1/board-states/{id}", tags: [TAG] })
    .input(withParams(idParamSchema, updateBoardStateSchema))
    .errors({ ...NOT_FOUND, ...INVALID_RULES })
    .output(boardStateResponseSchema),
  remove: authedRoute
    .route({
      method: "DELETE",
      path: "/api/v1/board-states/{id}",
      tags: [TAG],
      successStatus: 204,
    })
    .input(idParamSchema)
    .errors(NOT_FOUND),
  share: authedRoute
    .route({ method: "POST", path: "/api/v1/board-states/{id}/share", tags: [TAG] })
    .input(idParamSchema)
    .errors(NOT_FOUND)
    .output(boardStateShareResponseSchema),
  unshare: authedRoute
    .route({
      method: "DELETE",
      path: "/api/v1/board-states/{id}/share",
      tags: [TAG],
      successStatus: 204,
    })
    .input(idParamSchema)
    .errors(NOT_FOUND),
};

export type BoardStatesContract = typeof boardStatesContract;
