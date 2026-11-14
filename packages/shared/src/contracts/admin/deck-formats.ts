import { slugParamSchema, withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import { kebabSlugSchema, taxonomyEntitySchema, taxonomyReorderInputSchema } from "./shared.js";

const TAG = "Admin - Deck Formats";

const BASE = "/api/admin/v1/deck-formats";

/** The literal `reorder` path must precede `{slug}` in route registration order. */
export const adminDeckFormatsContract = {
  list: authedRoute
    .route({ method: "GET", path: BASE, tags: [TAG] })
    .output(z.object({ deckFormats: z.array(taxonomyEntitySchema) })),
  reorder: authedRoute
    .route({ method: "PUT", path: `${BASE}/reorder`, tags: [TAG], successStatus: 204 })
    .errors({ BAD_REQUEST: { message: "Invalid reorder request" } })
    .input(taxonomyReorderInputSchema),
  create: authedRoute
    .route({ method: "POST", path: BASE, tags: [TAG], successStatus: 201 })
    .errors({ CONFLICT: { message: "Deck format already exists" } })
    .input(
      z.object({
        slug: kebabSlugSchema,
        label: z.string().min(1),
      }),
    )
    .output(z.object({ deckFormat: taxonomyEntitySchema })),
  update: authedRoute
    .route({ method: "PATCH", path: `${BASE}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Deck format not found" } })
    .input(withParams(slugParamSchema, { label: z.string().min(1).optional() })),
  remove: authedRoute
    .route({ method: "DELETE", path: `${BASE}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({
      NOT_FOUND: { message: "Deck format not found" },
      CONFLICT: { message: "Deck format cannot be deleted" },
    })
    .input(slugParamSchema),
};

export type AdminDeckFormatsContract = typeof adminDeckFormatsContract;
export interface AdminDeckFormatsResponse {
  deckFormats: z.infer<typeof taxonomyEntitySchema>[];
}
