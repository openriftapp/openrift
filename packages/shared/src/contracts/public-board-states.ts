import { boardDocumentSchema } from "@openrift/shared/board-state";
import { oc } from "@orpc/contract";
import { z } from "zod";

export const publicBoardStateResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  answer: z.string().nullable(),
  coreRulesVersion: z.string().nullable(),
  tournamentRulesVersion: z.string().nullable(),
  document: boardDocumentSchema,
  isFeatured: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const publicBoardStateDetailResponseSchema = z.object({
  boardState: publicBoardStateResponseSchema,
  owner: z.object({ displayName: z.string() }),
});

export const featuredBoardStateResponseSchema = publicBoardStateResponseSchema.extend({
  shareToken: z.string(),
});

export const featuredBoardStateListResponseSchema = z.object({
  items: z.array(featuredBoardStateResponseSchema),
});

export const publicBoardStatesContract = {
  share: oc
    .route({ method: "GET", path: "/api/v1/board-states/share/{token}", tags: ["Board states"] })
    .meta({ auth: "public", cache: "short" })
    .input(z.object({ token: z.string().min(1) }))
    .errors({ NOT_FOUND: { message: "Not found" } })
    .output(publicBoardStateDetailResponseSchema),
  featured: oc
    .route({ method: "GET", path: "/api/v1/featured-board-states", tags: ["Board states"] })
    .meta({ auth: "public", cache: "short" })
    .output(featuredBoardStateListResponseSchema),
};

export type PublicBoardStatesContract = typeof publicBoardStatesContract;
