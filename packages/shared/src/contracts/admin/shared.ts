import { z } from "zod";

// Feature-flag and site-setting keys use a stricter, separate regex; don't unify.
export const slugRegex = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

export const kebabSlugSchema = z.string().min(1).regex(slugRegex, "Slug must be kebab-case");

export const kebabKeyRegex = /^[a-z][a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const jobStartedResponseSchema = z.object({
  runId: z.uuid(),
  status: z.enum(["running", "already_running"]),
});

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/u)
  .nullable();

export const taxonomyEntitySchema = z.object({
  slug: z.string(),
  label: z.string(),
  sortOrder: z.number(),
  isWellKnown: z.boolean(),
});

export const colorTaxonomyEntitySchema = taxonomyEntitySchema.extend({
  color: z.string().nullable(),
});

export const taxonomyReorderInputSchema = z.object({ slugs: z.array(z.string().min(1)).min(1) });
