import { isoDate } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";

const TAG = "Admin - Formats";

const FORMAT_SETS = "/api/admin/v1/format-sets";

const formatSetSchema = z.object({
  id: z.string(),
  formatId: z.string(),
  setId: z.string(),
  setSlug: z.string(),
  circuit: z.string().nullable(),
  legalFrom: isoDate.nullable(),
  legalUntil: isoDate.nullable(),
});

const formatSetKeySchema = z.object({
  formatId: z.string().min(1),
  setId: z.uuid(),
  circuit: z.string().min(1).nullable(),
});

/** One row per format, set and circuit; a null circuit is the global window. */
export const adminFormatSetsContract = {
  list: authedRoute
    .route({ method: "GET", path: FORMAT_SETS, tags: [TAG] })
    .output(z.object({ formatSets: z.array(formatSetSchema) })),
  upsert: authedRoute
    .route({ method: "PUT", path: FORMAT_SETS, tags: [TAG] })
    .errors({ BAD_REQUEST: { message: "Invalid legality window" } })
    .input(
      formatSetKeySchema
        .extend({ legalFrom: isoDate.nullable(), legalUntil: isoDate.nullable() })
        .refine(
          (input) =>
            input.legalUntil === null ||
            (input.legalFrom !== null && input.legalUntil > input.legalFrom),
          { message: "Legal until must come after legal from", path: ["legalUntil"] },
        ),
    )
    .output(z.object({ formatSet: formatSetSchema })),
  remove: authedRoute
    .route({ method: "DELETE", path: FORMAT_SETS, tags: [TAG], successStatus: 204 })
    .errors({ NOT_FOUND: { message: "Window not found" } })
    .input(formatSetKeySchema),
};

export type AdminFormatSetsContract = typeof adminFormatSetsContract;
export type AdminFormatSetResponse = z.infer<typeof formatSetSchema>;
