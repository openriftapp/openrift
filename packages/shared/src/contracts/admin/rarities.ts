import { slugParamSchema, withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import {
  colorTaxonomyEntitySchema,
  hexColorSchema,
  kebabSlugSchema,
  taxonomyReorderInputSchema,
} from "./shared.js";

const TAG = "Admin - Rarities";

const BASE = "/api/admin/v1/rarities";

export const adminRaritiesContract = {
  list: authedRoute
    .route({ method: "GET", path: BASE, tags: [TAG] })
    .output(z.object({ rarities: z.array(colorTaxonomyEntitySchema) })),
  reorder: authedRoute
    .route({ method: "PUT", path: `${BASE}/reorder`, tags: [TAG], successStatus: 204 })
    .errors({ BAD_REQUEST: { message: "Invalid reorder request" } })
    .input(taxonomyReorderInputSchema),
  create: authedRoute
    .route({ method: "POST", path: BASE, tags: [TAG], successStatus: 201 })
    .errors({ CONFLICT: { message: "Rarity already exists" } })
    .input(
      z.object({
        slug: kebabSlugSchema,
        label: z.string().min(1),
        color: hexColorSchema.optional(),
      }),
    )
    .output(z.object({ rarity: colorTaxonomyEntitySchema })),
  update: authedRoute
    .route({ method: "PATCH", path: `${BASE}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Rarity not found" } })
    .input(
      withParams(slugParamSchema, {
        label: z.string().min(1).optional(),
        color: hexColorSchema.optional(),
      }),
    ),
  remove: authedRoute
    .route({ method: "DELETE", path: `${BASE}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({
      NOT_FOUND: { message: "Rarity not found" },
      CONFLICT: { message: "Rarity cannot be deleted" },
    })
    .input(slugParamSchema),
};

export type AdminRaritiesContract = typeof adminRaritiesContract;
export interface AdminRaritiesResponse {
  rarities: z.infer<typeof colorTaxonomyEntitySchema>[];
}
