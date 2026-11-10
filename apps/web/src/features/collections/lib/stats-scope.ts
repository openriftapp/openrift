import { cardFiltersPredicate } from "@openrift/shared/filters";
import type { CompletionScopePreference } from "@openrift/shared/types/api/preferences";
import type { Printing } from "@openrift/shared/types/catalog";
import type { CardFilters, PresenceDimension } from "@openrift/shared/types/search";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";

type ScopeKey = keyof CompletionScopePreference;

type ArrayFilterKey = {
  [K in keyof CardFilters]: CardFilters[K] extends readonly string[] ? K : never;
}[keyof CardFilters];

type FlagFilterKey = {
  [K in keyof CardFilters]: CardFilters[K] extends boolean | null ? K : never;
}[keyof CardFilters];

type StatsScopeField =
  | { kind: "values"; filter: ArrayFilterKey }
  | { kind: "flag"; filter: FlagFilterKey }
  | { kind: "presence"; dimension: PresenceDimension; any: string; none: string };

const STATS_SCOPE_FIELDS = {
  sets: { kind: "values", filter: "sets" },
  languages: { kind: "values", filter: "languages" },
  domains: { kind: "values", filter: "domains" },
  types: { kind: "values", filter: "types" },
  rarities: { kind: "values", filter: "rarities" },
  finishes: { kind: "values", filter: "finishes" },
  artVariants: { kind: "values", filter: "artVariants" },
  keywords: { kind: "values", filter: "keywords" },
  tags: { kind: "values", filter: "tags" },
  customTags: { kind: "values", filter: "customTagSlugs" },
  cardSizes: { kind: "values", filter: "cardSizes" },
  standard: { kind: "flag", filter: "isStandard" },
  keywordsPresence: { kind: "presence", dimension: "keywords", any: "any", none: "none" },
  tagsPresence: { kind: "presence", dimension: "tags", any: "any", none: "none" },
  customTagsPresence: { kind: "presence", dimension: "customTags", any: "any", none: "none" },
  setsExclude: { kind: "values", filter: "setsExclude" },
  languagesExclude: { kind: "values", filter: "languagesExclude" },
  domainsExclude: { kind: "values", filter: "domainsExclude" },
  typesExclude: { kind: "values", filter: "typesExclude" },
  raritiesExclude: { kind: "values", filter: "raritiesExclude" },
  finishesExclude: { kind: "values", filter: "finishesExclude" },
  artVariantsExclude: { kind: "values", filter: "artVariantsExclude" },
  keywordsExclude: { kind: "values", filter: "keywordsExclude" },
  tagsExclude: { kind: "values", filter: "tagsExclude" },
  customTagsExclude: { kind: "values", filter: "customTagSlugsExclude" },
  promos: { kind: "presence", dimension: "markers", any: "only", none: "exclude" },
  signed: { kind: "flag", filter: "isSigned" },
  overnumbered: { kind: "flag", filter: "isOvernumbered" },
  banned: { kind: "flag", filter: "isBanned" },
  errata: { kind: "flag", filter: "hasErrata" },
} as const satisfies Record<ScopeKey, StatsScopeField>;

const SCOPE_ENTRIES = Object.entries(STATS_SCOPE_FIELDS) as [ScopeKey, StatsScopeField][];

export function scopeFromFilters(filters: CardFilters): CompletionScopePreference {
  const scope: Record<string, unknown> = {};
  for (const [key, field] of SCOPE_ENTRIES) {
    if (field.kind === "values") {
      const values = filters[field.filter];
      if (values.length > 0) {
        scope[key] = values;
      }
    } else if (field.kind === "flag") {
      const flag = filters[field.filter];
      if (flag !== null) {
        scope[key] = flag;
      }
    } else {
      const state = filters.presence[field.dimension];
      if (state) {
        scope[key] = state === "any" ? field.any : field.none;
      }
    }
  }
  return scope as CompletionScopePreference;
}

export function scopeToCardFilters(scope: CompletionScopePreference): CardFilters {
  const filters: Record<string, unknown> = { ...EMPTY_CARD_FILTERS };
  const presence: CardFilters["presence"] = {};
  for (const [key, field] of SCOPE_ENTRIES) {
    const value = scope[key];
    if (value === undefined) {
      continue;
    }
    if (field.kind === "presence") {
      if (value === field.any) {
        presence[field.dimension] = "any";
      } else if (value === field.none) {
        presence[field.dimension] = "none";
      }
    } else {
      filters[field.filter] = value;
    }
  }
  filters.presence = presence;
  return filters as CardFilters;
}

export function statsScopePredicate(
  scope: CompletionScopePreference,
  customTagAssignments?: Record<string, readonly string[]>,
): (printing: Printing) => boolean {
  return cardFiltersPredicate(scopeToCardFilters(scope), { customTagAssignments });
}
