import { slugParamSchema, withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import { kebabSlugSchema, taxonomyEntitySchema, taxonomyReorderInputSchema } from "./shared.js";

const TAG = "Admin - Art Variants";

const AV = "/api/admin/v1/art-variants";

/** `reorder`'s static path must precede `{slug}` in mount order. */
export const adminArtVariantsContract = {
  list: authedRoute
    .route({ method: "GET", path: AV, tags: [TAG] })
    .output(z.object({ artVariants: z.array(taxonomyEntitySchema) })),
  reorder: authedRoute
    .route({ method: "PUT", path: `${AV}/reorder`, tags: [TAG], successStatus: 204 })
    .errors({ BAD_REQUEST: { message: "Invalid reorder request" } })
    .input(taxonomyReorderInputSchema),
  create: authedRoute
    .route({ method: "POST", path: AV, tags: [TAG], successStatus: 201 })
    .errors({ CONFLICT: { message: "Art variant already exists" } })
    .input(
      z.object({
        slug: kebabSlugSchema,
        label: z.string().min(1),
      }),
    )
    .output(z.object({ artVariant: taxonomyEntitySchema })),
  update: authedRoute
    .route({ method: "PATCH", path: `${AV}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Art variant not found" } })
    .input(withParams(slugParamSchema, { label: z.string().min(1).optional() })),
  remove: authedRoute
    .route({ method: "DELETE", path: `${AV}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({
      NOT_FOUND: { message: "Art variant not found" },
      CONFLICT: { message: "Art variant cannot be deleted" },
    })
    .input(slugParamSchema),
};

export type AdminArtVariantsContract = typeof adminArtVariantsContract;
export interface AdminArtVariantsResponse {
  artVariants: z.infer<typeof taxonomyEntitySchema>[];
}
