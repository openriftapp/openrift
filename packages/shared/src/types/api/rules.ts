import type {
  ruleChangeTypeSchema,
  ruleChangesResponseSchema,
  ruleKindSchema,
  ruleLanguageSchema,
  ruleResponseSchema,
  ruleTypeSchema,
  ruleVersionResponseSchema,
  ruleVersionsListResponseSchema,
  rulePageEntrySchema,
  ruleSourceResponseSchema,
  rulesListResponseSchema,
  rulesPageResponseSchema,
} from "@openrift/shared/contracts/rules";
import type { z } from "zod";

export type RuleKind = z.infer<typeof ruleKindSchema>;

export type RuleLanguage = z.infer<typeof ruleLanguageSchema>;

export type RuleType = z.infer<typeof ruleTypeSchema>;

export type RuleChangeType = z.infer<typeof ruleChangeTypeSchema>;

export type RuleResponse = z.infer<typeof ruleResponseSchema>;

export type RuleVersionResponse = z.infer<typeof ruleVersionResponseSchema>;

export type RuleChangesResponse = z.infer<typeof ruleChangesResponseSchema>;

export type RulesListResponse = z.infer<typeof rulesListResponseSchema>;

export type RuleVersionsListResponse = z.infer<typeof ruleVersionsListResponseSchema>;

export type RulePageEntry = z.infer<typeof rulePageEntrySchema>;

export type RulesPageResponse = z.infer<typeof rulesPageResponseSchema>;

export type RuleSourceResponse = z.infer<typeof ruleSourceResponseSchema>;
