import { slugParamSchema, withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import { kebabSlugSchema, taxonomyEntitySchema, taxonomyReorderInputSchema } from "./shared.js";

const TAG = "Admin - Finishes";

const BASE = "/api/admin/v1/finishes";

/**
 * Admin finish taxonomy CRUD, mounted at `/api/admin/v1/finishes`. The static
 * `reorder` path must precede `{slug}`.
 */
export const adminFinishesContract = {
  list: authedRoute
    .route({ method: "GET", path: BASE, tags: [TAG] })
    .meta({ adminSections: ["printing-desk"] })
    .output(z.object({ finishes: z.array(taxonomyEntitySchema) })),
  reorder: authedRoute
    .route({ method: "PUT", path: `${BASE}/reorder`, tags: [TAG], successStatus: 204 })
    .errors({ BAD_REQUEST: { message: "Invalid or incomplete list of finish slugs" } })
    .input(taxonomyReorderInputSchema),
  create: authedRoute
    .route({ method: "POST", path: BASE, tags: [TAG], successStatus: 201 })
    .errors({ CONFLICT: { message: "A finish with that slug already exists" } })
    .input(
      z.object({
        slug: kebabSlugSchema,
        label: z.string().min(1),
      }),
    )
    .output(z.object({ finish: taxonomyEntitySchema })),
  update: authedRoute
    .route({ method: "PATCH", path: `${BASE}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Finish not found" } })
    .input(withParams(slugParamSchema, { label: z.string().min(1).optional() })),
  remove: authedRoute
    .route({ method: "DELETE", path: `${BASE}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({
      NOT_FOUND: { message: "Finish not found" },
      CONFLICT: { message: "Finish is well-known or in use by one or more printings" },
    })
    .input(slugParamSchema),
};

export type AdminFinishesContract = typeof adminFinishesContract;
export interface AdminFinishesResponse {
  finishes: z.infer<typeof taxonomyEntitySchema>[];
}
