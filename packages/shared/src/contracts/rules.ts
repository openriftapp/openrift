import { oc } from "@orpc/contract";
import { z } from "zod";

import { RULE_LANGUAGES } from "../rules.js";

export { RULE_LANGUAGES } from "../rules.js";

/** Which rulebook a rule belongs to. Mirrors the `rules.kind` CHECK. */
export const RULE_KINDS = ["core", "tournament"] as const;
/** A rule's role in the document outline. Mirrors the `rules.rule_type` CHECK. */
export const RULE_TYPES = ["title", "subtitle", "text"] as const;
/** How a rule differs from the previous version. Mirrors the `rules.change_type` CHECK. */
export const RULE_CHANGE_TYPES = ["added", "modified", "removed", "unchanged"] as const;

export const ruleKindSchema = z.enum(RULE_KINDS);
export const ruleTypeSchema = z.enum(RULE_TYPES);
export const ruleChangeTypeSchema = z.enum(RULE_CHANGE_TYPES);
export const ruleLanguageSchema = z.enum(RULE_LANGUAGES);
const languageInput = ruleLanguageSchema.default("en");

export const ruleResponseSchema = z.object({
  id: z.string().meta({ examples: ["019cfc3b-0369-7000-8000-000000000100"] }),
  kind: ruleKindSchema,
  language: ruleLanguageSchema,
  version: z.string().meta({ examples: ["1.2.0"] }),
  ruleNumber: z.string().meta({ examples: ["3.4.1"] }),
  sortOrder: z.number().meta({ examples: [120] }),
  depth: z.number().meta({ examples: [2] }),
  ruleType: ruleTypeSchema,
  content: z.string().meta({
    examples: ["A player loses the game if they would draw a card from an empty deck."],
  }),
  changeType: ruleChangeTypeSchema,
});

export const rulePageEntrySchema = ruleResponseSchema.omit({ content: true }).extend({
  contentHtml: z.string().meta({
    examples: ['A player loses the game. See <a href="#rule-540">rule 540</a>.'],
  }),
});

export const ruleVersionResponseSchema = z.object({
  kind: ruleKindSchema,
  language: ruleLanguageSchema,
  version: z.string().meta({ examples: ["1.2.0"] }),
  comments: z
    .string()
    .nullable()
    .meta({ examples: ["First public release."] }),
  commentsHtml: z
    .string()
    .nullable()
    .meta({ examples: ["<p>First public release.</p>"] }),
  label: z
    .string()
    .nullable()
    .meta({ examples: ["Vendetta"] }),
  documentVersion: z
    .string()
    .nullable()
    .meta({ examples: ["1.4"] }),
  importedAt: z.string().meta({ examples: ["2026-02-16T08:30:00Z"] }),
  languages: z.array(ruleLanguageSchema).meta({ examples: [["en", "fr", "ko"]] }),
});

export const ruleChangesResponseSchema = z.object({
  added: z.array(z.string()),
  modifiedPrev: z.record(z.string(), z.string()),
  removed: z.array(ruleResponseSchema),
});

export const rulesListResponseSchema = z.object({
  kind: ruleKindSchema,
  language: ruleLanguageSchema,
  rules: z.array(ruleResponseSchema),
  version: z.string(),
  changes: ruleChangesResponseSchema.optional(),
});

export const rulesPageResponseSchema = z.object({
  kind: ruleKindSchema,
  language: ruleLanguageSchema,
  version: z.string(),
  rules: z.array(rulePageEntrySchema),
});

export const ruleSourceResponseSchema = z.object({
  added: z.array(z.string()),
  modified: z.array(z.string()),
  current: z.record(z.string(), z.string()),
  modifiedPrev: z.record(z.string(), z.string()),
  removed: z.array(rulePageEntrySchema.extend({ content: z.string() })),
});

export const ruleVersionsListResponseSchema = z.object({
  versions: z.array(ruleVersionResponseSchema),
  languages: z.array(ruleLanguageSchema),
});

export const rulesContract = {
  list: oc
    .route({ method: "GET", path: "/api/v1/rules", tags: ["Rules"] })
    .meta({ auth: "public", cache: "long", etag: true })
    .input(
      z.object({
        kind: ruleKindSchema,
        version: z.string().optional(),
        language: languageInput,
      }),
    )
    .output(rulesListResponseSchema),
  page: oc
    .route({ method: "GET", path: "/api/v1/rules/page", tags: ["Rules"] })
    .meta({ auth: "public", cache: "long", etag: true })
    .input(z.object({ kind: ruleKindSchema, version: z.string(), language: languageInput }))
    .output(rulesPageResponseSchema),
  source: oc
    .route({ method: "GET", path: "/api/v1/rules/source", tags: ["Rules"] })
    .meta({ auth: "public", cache: "long", etag: true })
    .input(z.object({ kind: ruleKindSchema, version: z.string(), language: languageInput }))
    .output(ruleSourceResponseSchema),
  versions: oc
    .route({ method: "GET", path: "/api/v1/rules/versions", tags: ["Rules"] })
    .meta({ auth: "public", cache: "long", etag: true })
    .input(z.object({ kind: ruleKindSchema.optional(), language: languageInput }))
    .output(ruleVersionsListResponseSchema),
};

export type RulesContract = typeof rulesContract;
