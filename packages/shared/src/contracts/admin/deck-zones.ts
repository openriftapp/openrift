import { slugParamSchema, withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import { taxonomyEntitySchema, taxonomyReorderInputSchema } from "./shared.js";

const TAG = "Admin - Deck Zones";

const DZ = "/api/admin/v1/deck-zones";

/** The literal `reorder` path must precede `{slug}` in route registration order. */
export const adminDeckZonesContract = {
  list: authedRoute
    .route({ method: "GET", path: DZ, tags: [TAG] })
    .output(z.object({ deckZones: z.array(taxonomyEntitySchema) })),
  reorder: authedRoute
    .route({ method: "PUT", path: `${DZ}/reorder`, tags: [TAG], successStatus: 204 })
    .errors({ BAD_REQUEST: { message: "Invalid reorder request" } })
    .input(taxonomyReorderInputSchema),
  update: authedRoute
    .route({ method: "PATCH", path: `${DZ}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Deck zone not found" } })
    .input(withParams(slugParamSchema, { label: z.string().min(1).optional() })),
};

export type AdminDeckZonesContract = typeof adminDeckZonesContract;
export interface AdminDeckZonesResponse {
  deckZones: z.infer<typeof taxonomyEntitySchema>[];
}
