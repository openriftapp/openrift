import { withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";
import { ruleKindSchema } from "../rules.js";

const TAG = "Admin - Rules";

const RULES = "/api/admin/v1/rules";

const versionParamSchema = z.object({ kind: ruleKindSchema, version: z.string() });

const versionDetailsSchema = z.object({
  comments: z.string().nullable(),
  label: z.string().min(1).nullable(),
  documentVersion: z.string().min(1).nullable(),
});

export const adminRulesContract = {
  import: authedRoute
    .route({ method: "POST", path: `${RULES}/import`, tags: [TAG], successStatus: 201 })
    .errors({
      CONFLICT: { message: "Rules version already exists" },
      BAD_REQUEST: { message: "Invalid rules content or version order" },
    })
    .input(
      z.object({
        kind: ruleKindSchema,
        version: z.string().min(1),
        comments: z.string().nullable().optional(),
        label: z.string().min(1).nullable().optional(),
        documentVersion: z.string().min(1).nullable().optional(),
        content: z.string().min(1),
      }),
    )
    .output(
      z.object({
        kind: ruleKindSchema,
        version: z.string(),
        rulesCount: z.number(),
        added: z.number(),
        modified: z.number(),
        removed: z.number(),
      }),
    ),
  removeVersion: authedRoute
    .route({
      method: "DELETE",
      path: `${RULES}/{kind}/versions/{version}`,
      tags: [TAG],
      successStatus: 204,
    })
    .errors({ NOT_FOUND: { message: "Rules version not found" } })
    .input(versionParamSchema),
  updateVersion: authedRoute
    .route({ method: "PATCH", path: `${RULES}/{kind}/versions/{version}`, tags: [TAG] })
    .errors({ NOT_FOUND: { message: "Rules version not found" } })
    .input(withParams(versionParamSchema, versionDetailsSchema.shape))
    .output(versionParamSchema.extend(versionDetailsSchema.shape)),
};

export type AdminRulesContract = typeof adminRulesContract;
