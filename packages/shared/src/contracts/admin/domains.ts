import { slugParamSchema, withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import {
  colorTaxonomyEntitySchema,
  hexColorSchema,
  kebabSlugSchema,
  taxonomyReorderInputSchema,
} from "./shared.js";

const TAG = "Admin - Domains";

const BASE = "/api/admin/v1/domains";

/**
 * Admin domain taxonomy CRUD, mounted at `/api/admin/v1/domains`. The static
 * `reorder` path must precede `{slug}`.
 */
export const adminDomainsContract = {
  list: authedRoute
    .route({ method: "GET", path: BASE, tags: [TAG] })
    .output(z.object({ domains: z.array(colorTaxonomyEntitySchema) })),
  reorder: authedRoute
    .route({ method: "PUT", path: `${BASE}/reorder`, tags: [TAG], successStatus: 204 })
    .errors({ BAD_REQUEST: { message: "Invalid or incomplete list of domain slugs" } })
    .input(taxonomyReorderInputSchema),
  create: authedRoute
    .route({ method: "POST", path: BASE, tags: [TAG], successStatus: 201 })
    .errors({ CONFLICT: { message: "A domain with that slug already exists" } })
    .input(
      z.object({
        slug: kebabSlugSchema,
        label: z.string().min(1),
        color: hexColorSchema.optional(),
      }),
    )
    .output(z.object({ domain: colorTaxonomyEntitySchema })),
  update: authedRoute
    .route({ method: "PATCH", path: `${BASE}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Domain not found" } })
    .input(
      withParams(slugParamSchema, {
        label: z.string().min(1).optional(),
        color: hexColorSchema.optional(),
      }),
    ),
  remove: authedRoute
    .route({ method: "DELETE", path: `${BASE}/{slug}`, tags: [TAG], successStatus: 204 })
    .errors({
      NOT_FOUND: { message: "Domain not found" },
      CONFLICT: { message: "Domain is well-known or in use by one or more cards" },
    })
    .input(slugParamSchema),
};

export type AdminDomainsContract = typeof adminDomainsContract;
export interface AdminDomainsResponse {
  domains: z.infer<typeof colorTaxonomyEntitySchema>[];
}
