/**
 * Maps top-level query clauses onto the filter buttons that select the same printings,
 * so `d:fury` lights the Fury button and a click on that dimension moves the clause into it.
 */

import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { resolveSearchQuery } from "@openrift/shared/search-query/bind";
import { removeSearchSpan, searchTermSpan } from "@openrift/shared/search-query/edit";
import type { IsValue, SearchKeyId, SearchOperator } from "@openrift/shared/search-query/keys";
import type { QueryNode, SearchSpan } from "@openrift/shared/search-query/parse";
import { parseSearchQuery } from "@openrift/shared/search-query/parse";
import { NONE } from "@openrift/shared/types/search";
import { WellKnown } from "@openrift/shared/well-known";

import type { FilterSearch } from "@/features/cards/lib/search-schemas";

export type QueryFilterFamily =
  | "sets"
  | "languages"
  | "rarities"
  | "types"
  | "superTypes"
  | "domains"
  | "artVariants"
  | "finishes"
  | "cardSizes"
  | "markers"
  | "channels"
  | "customTags"
  | "keywords"
  | "tags";

type QueryFilterFlag = "signed" | "overnumbered" | "errata" | "noImage" | "standard";

type QueryFilterRange = "energy" | "might" | "power" | "price";

type QueryFilterGroup = QueryFilterFamily | QueryFilterFlag | QueryFilterRange;

type PresenceFamily = "markers" | "keywords" | "tags";

export interface QueryFilterOptions {
  vocabulary: SearchVocabulary;
  visible: ReadonlySet<string>;
  values: Partial<Record<QueryFilterFamily, readonly string[]>>;
  nullableRanges: ReadonlySet<string>;
}

type Target =
  | { kind: "value"; family: QueryFilterFamily; value: string; exclude: boolean }
  | { kind: "presence"; family: PresenceFamily; value: "any" | "none" }
  | { kind: "flag"; flag: QueryFilterFlag; value: boolean }
  | { kind: "bound"; range: QueryFilterRange; min?: number; max?: number };

interface Entry {
  group: QueryFilterGroup;
  span: SearchSpan;
  target: Target;
}

const EXCLUDE_KEYS: Partial<Record<QueryFilterFamily, keyof FilterSearch>> = {
  sets: "setsEx",
  languages: "languagesEx",
  rarities: "raritiesEx",
  types: "typesEx",
  superTypes: "superTypesEx",
  domains: "domainsEx",
  artVariants: "artVariantsEx",
  finishes: "finishesEx",
  markers: "markersEx",
  channels: "channelsEx",
  customTags: "customTagsEx",
  keywords: "keywordsEx",
  tags: "tagsEx",
};

const PRESENCE_KEYS: Record<PresenceFamily, keyof FilterSearch> = {
  markers: "markersPresence",
  keywords: "keywordsPresence",
  tags: "tagsPresence",
};

const RANGE_KEYS: Record<QueryFilterRange, { min: keyof FilterSearch; max: keyof FilterSearch }> = {
  energy: { min: "energyMin", max: "energyMax" },
  might: { min: "mightMin", max: "mightMax" },
  power: { min: "powerMin", max: "powerMax" },
  price: { min: "priceMin", max: "priceMax" },
};

const NULL_AS_ZERO: ReadonlySet<QueryFilterRange> = new Set(["energy", "power"]);

const FLAGS: readonly QueryFilterFlag[] = [
  "signed",
  "overnumbered",
  "errata",
  "noImage",
  "standard",
];

const PARAM_GROUPS: ReadonlyMap<string, QueryFilterGroup> = new Map<string, QueryFilterGroup>([
  ...(Object.keys(EXCLUDE_KEYS) as QueryFilterFamily[]).map(
    (family) => [EXCLUDE_KEYS[family] as string, family] as const,
  ),
  ...(Object.keys(PRESENCE_KEYS) as PresenceFamily[]).map(
    (family) => [PRESENCE_KEYS[family] as string, family] as const,
  ),
  ...(
    [
      "sets",
      "languages",
      "rarities",
      "types",
      "superTypes",
      "domains",
      "artVariants",
      "finishes",
      "cardSizes",
      "markers",
      "channels",
      "customTags",
      "keywords",
      "tags",
    ] as const
  ).map((family) => [family, family] as const),
  ...FLAGS.map((flag) => [flag, flag] as const),
  ...(Object.keys(RANGE_KEYS) as QueryFilterRange[]).flatMap((range) => [
    [RANGE_KEYS[range].min as string, range] as const,
    [RANGE_KEYS[range].max as string, range] as const,
  ]),
]);

function value(family: QueryFilterFamily, slug: string, exclude: boolean): Target {
  return { kind: "value", family, value: slug, exclude };
}

function isTarget(isValue: IsValue, positive: boolean): Target | null {
  switch (isValue) {
    case "foil": {
      return value("finishes", WellKnown.finish.FOIL, !positive);
    }
    case "metal": {
      return value("finishes", WellKnown.finish.METAL, !positive);
    }
    case "metaldeluxe": {
      return value("finishes", WellKnown.finish.METAL_DELUXE, !positive);
    }
    case "nonfoil": {
      return value("finishes", WellKnown.finish.NORMAL, !positive);
    }
    case "altart": {
      return value("artVariants", WellKnown.artVariant.ALTART, !positive);
    }
    case "ultimate": {
      return value("artVariants", WellKnown.artVariant.ULTIMATE, !positive);
    }
    case "oversized": {
      return positive ? value("cardSizes", WellKnown.cardSize.OVERSIZED, false) : null;
    }
    case "signed":
    case "overnumbered": {
      return { kind: "flag", flag: isValue, value: positive };
    }
    case "plain": {
      return { kind: "flag", flag: "standard", value: positive };
    }
    case "variant": {
      return { kind: "flag", flag: "standard", value: !positive };
    }
    case "promo": {
      return { kind: "presence", family: "markers", value: positive ? "any" : "none" };
    }
    default: {
      return null;
    }
  }
}

function hasTarget(hasValue: string, positive: boolean): Target | null {
  switch (hasValue) {
    case "errata": {
      return { kind: "flag", flag: "errata", value: positive };
    }
    case "image": {
      return { kind: "flag", flag: "noImage", value: !positive };
    }
    case "marker": {
      return { kind: "presence", family: "markers", value: positive ? "any" : "none" };
    }
    case "keyword": {
      return { kind: "presence", family: "keywords", value: positive ? "any" : "none" };
    }
    case "tag": {
      return { kind: "presence", family: "tags", value: positive ? "any" : "none" };
    }
    default: {
      return null;
    }
  }
}

function boundTarget(
  range: QueryFilterRange,
  operator: SearchOperator,
  raw: string,
): Target | null {
  const number = Number(raw);
  const steps = range !== "price" && Number.isInteger(number);
  switch (operator) {
    case ":":
    case "=": {
      return { kind: "bound", range, min: number, max: number };
    }
    case ">=": {
      return { kind: "bound", range, min: number };
    }
    case "<=": {
      return { kind: "bound", range, max: number };
    }
    case ">": {
      return steps ? { kind: "bound", range, min: number + 1 } : null;
    }
    case "<": {
      return steps ? { kind: "bound", range, max: number - 1 } : null;
    }
    case "!=": {
      return null;
    }
  }
}

const SLUG_FAMILIES = {
  rarity: "rarities",
  set: "sets",
  lang: "languages",
  marker: "markers",
  channel: "channels",
  ctag: "customTags",
} as const satisfies Partial<Record<SearchKeyId, QueryFilterFamily>>;

function slugTarget(
  family: QueryFilterFamily,
  operator: SearchOperator,
  slug: string,
  negated: boolean,
): Target | null {
  if (operator === ":" || operator === "=") {
    return value(family, slug, negated);
  }
  return operator === "!=" ? value(family, slug, !negated) : null;
}

function clauseTarget(
  node: Extract<QueryNode, { kind: "clause" }>,
  negated: boolean,
  options: QueryFilterOptions,
): Target | null {
  const { key, operator } = node;
  const match = (family: QueryFilterFamily, wanted: string) => {
    const folded = wanted.trim().toLowerCase();
    return options.values[family]?.find((candidate) => candidate.toLowerCase() === folded);
  };
  const slug = (family: QueryFilterFamily, operatorTarget: (found: string) => Target | null) => {
    if (node.value.includes(",")) {
      return null;
    }
    const found = match(family, node.value);
    return found === undefined ? null : operatorTarget(found);
  };
  switch (key) {
    case "domain": {
      // `d=fury` is mono-Fury and `d!=fury` its negation; only "has Fury" is a button.
      return operator === ":" || operator === ">="
        ? slug("domains", (found) => value("domains", found, negated))
        : null;
    }
    case "rarity":
    case "set":
    case "lang":
    case "marker":
    case "channel":
    case "ctag": {
      const family = SLUG_FAMILIES[key];
      return slug(family, (found) => slugTarget(family, operator, found, negated));
    }
    case "type": {
      if (operator !== ":" && operator !== "!=") {
        return null;
      }
      const family = match("types", node.value) === undefined ? "superTypes" : "types";
      return slug(family, (found) => slugTarget(family, operator, found, negated));
    }
    case "keyword":
    case "tag": {
      if (operator !== ":" && operator !== "!=") {
        return null;
      }
      const family = key === "keyword" ? "keywords" : "tags";
      return slug(family, (found) => slugTarget(family, operator, found, negated));
    }
    case "is":
    case "not": {
      return isTarget(node.value as IsValue, (key === "is") !== negated);
    }
    case "has": {
      return hasTarget(node.value, !negated);
    }
    case "energy":
    case "might":
    case "power":
    case "price": {
      return negated ? null : boundTarget(key, operator, node.value);
    }
    default: {
      return null;
    }
  }
}

function groupOf(target: Target): QueryFilterGroup {
  switch (target.kind) {
    case "value":
    case "presence": {
      return target.family;
    }
    case "flag": {
      return target.flag;
    }
    case "bound": {
      return target.range;
    }
  }
}

function collectEntries(query: string, options: QueryFilterOptions): Entry[] {
  const resolved = resolveSearchQuery(parseSearchQuery(query), options.vocabulary);
  const root = resolved.root;
  const topLevel = root ? (root.kind === "and" ? root.children : [root]) : [];
  const entries: Entry[] = [];
  for (const node of topLevel) {
    let inner = node;
    let negated = false;
    while (inner.kind === "not") {
      negated = !negated;
      inner = inner.child;
    }
    if (inner.kind !== "clause") {
      continue;
    }
    const target = clauseTarget(inner, negated, options);
    if (target === null) {
      continue;
    }
    const group = groupOf(target);
    if (options.visible.has(group)) {
      entries.push({ group, span: searchTermSpan(node, resolved.terms), target });
    }
  }
  return entries;
}

type Patch = Partial<Record<keyof FilterSearch, unknown>>;

function readList(raw: FilterSearch, key: keyof FilterSearch | undefined): readonly string[] {
  return key === undefined ? [] : ((raw[key] as string[] | undefined) ?? []);
}

/** One included value per dimension: query clauses AND, while the buttons OR (domains: "only these"). */
function familyPatch(
  family: QueryFilterFamily,
  targets: readonly Target[],
  raw: FilterSearch,
): Patch | null {
  const includes: string[] = [];
  const excludes: string[] = [];
  const presences: ("any" | "none")[] = [];
  for (const target of targets) {
    if (target.kind === "value") {
      (target.exclude ? excludes : includes).push(target.value);
    } else if (target.kind === "presence") {
      presences.push(target.value);
    }
  }
  const excludeKey = EXCLUDE_KEYS[family];
  const presenceKey = family in PRESENCE_KEYS ? PRESENCE_KEYS[family as PresenceFamily] : undefined;
  const paramIncludes = readList(raw, family);
  const paramExcludes = readList(raw, excludeKey);
  const paramPresence = presenceKey === undefined ? undefined : raw[presenceKey];

  if (presences.length > 0) {
    const presence = presences[0];
    const conflicting =
      presenceKey === undefined ||
      presences.some((entry) => entry !== presence) ||
      includes.length > 0 ||
      excludes.length > 0 ||
      paramIncludes.length > 0 ||
      paramExcludes.length > 0 ||
      (paramPresence !== undefined && paramPresence !== presence);
    return conflicting ? null : { [presenceKey]: presence };
  }

  const included = includes[0];
  if (new Set(includes).size > 1) {
    return null;
  }
  if (
    included !== undefined &&
    (excludes.includes(included) ||
      paramExcludes.includes(included) ||
      paramPresence === "none" ||
      (paramIncludes.length > 0 && (paramIncludes.length > 1 || paramIncludes[0] !== included)))
  ) {
    return null;
  }
  if (excludes.some((excluded) => paramIncludes.includes(excluded))) {
    return null;
  }
  const patch: Patch = {};
  if (included !== undefined) {
    patch[family] = [included];
  }
  if (excludes.length > 0) {
    if (excludeKey === undefined) {
      return null;
    }
    patch[excludeKey] = [...new Set([...paramExcludes, ...excludes])];
  }
  return patch;
}

function flagPatch(flag: QueryFilterFlag, targets: readonly Target[], raw: FilterSearch) {
  const values = new Set(targets.map((target) => target.kind === "flag" && target.value));
  const [wanted] = values;
  if (values.size !== 1 || wanted === undefined) {
    return null;
  }
  return raw[flag] === undefined || raw[flag] === wanted ? { [flag]: wanted } : null;
}

/** The query reads a missing energy or power as 0; the range opts nulls in only through `NONE`. */
function rangePatch(
  range: QueryFilterRange,
  targets: readonly Target[],
  raw: FilterSearch,
  nullable: boolean,
) {
  const mins = new Set<number>();
  const maxes = new Set<number>();
  for (const target of targets) {
    if (target.kind === "bound") {
      if (target.min !== undefined) {
        mins.add(target.min);
      }
      if (target.max !== undefined) {
        maxes.add(target.max);
      }
    }
  }
  if (mins.size > 1 || maxes.size > 1) {
    return null;
  }
  let [min] = mins;
  const [max] = maxes;
  if (NULL_AS_ZERO.has(range) && nullable) {
    if (max !== undefined && max < 0) {
      return null;
    }
    if (min === undefined || min <= 0) {
      min = NONE;
    }
  }
  const keys = RANGE_KEYS[range];
  const paramMin = raw[keys.min];
  const paramMax = raw[keys.max];
  if (
    (paramMin !== undefined || paramMax !== undefined) &&
    (paramMin !== min || paramMax !== max)
  ) {
    return null;
  }
  return { [keys.min]: min, [keys.max]: max };
}

interface PlannedGroup {
  spans: SearchSpan[];
  patch: Patch;
}

function planGroups(
  raw: FilterSearch,
  options: QueryFilterOptions | null | undefined,
): Map<QueryFilterGroup, PlannedGroup> {
  const planned = new Map<QueryFilterGroup, PlannedGroup>();
  if (!options || !raw.q) {
    return planned;
  }
  const byGroup = Map.groupBy(collectEntries(raw.q, options), (entry) => entry.group);
  for (const [group, entries] of byGroup) {
    const targets = entries.map((entry) => entry.target);
    const patch =
      group in RANGE_KEYS
        ? rangePatch(group as QueryFilterRange, targets, raw, options.nullableRanges.has(group))
        : (FLAGS as readonly string[]).includes(group)
          ? flagPatch(group as QueryFilterFlag, targets, raw)
          : familyPatch(group as QueryFilterFamily, targets, raw);
    if (patch) {
      planned.set(group, { spans: entries.map((entry) => entry.span), patch });
    }
  }
  return planned;
}

export interface QueryFilterView {
  search: FilterSearch;
  spans: SearchSpan[];
}

export function showQueryFilters(
  raw: FilterSearch,
  options: QueryFilterOptions | null | undefined,
): QueryFilterView {
  const planned = planGroups(raw, options);
  if (planned.size === 0) {
    return { search: raw, spans: [] };
  }
  const search: Record<string, unknown> = { ...raw };
  const spans: SearchSpan[] = [];
  for (const group of planned.values()) {
    Object.assign(search, group.patch);
    spans.push(...group.spans);
  }
  return { search: search as FilterSearch, spans };
}

export function absorbQueryFilters<Search extends FilterSearch>(
  raw: Search,
  keys: readonly string[],
  options: QueryFilterOptions | null | undefined,
): Search {
  const groups = new Set(keys.flatMap((key) => PARAM_GROUPS.get(key) ?? []));
  if (groups.size === 0) {
    return raw;
  }
  const planned = planGroups(raw, options);
  const absorbed = [...planned].filter(([group]) => groups.has(group));
  if (absorbed.length === 0) {
    return raw;
  }
  const next: Record<string, unknown> = { ...raw };
  const spans: SearchSpan[] = [];
  for (const [, group] of absorbed) {
    Object.assign(next, group.patch);
    spans.push(...group.spans);
  }
  const query = spans
    .toSorted((a, b) => b.start - a.start)
    .reduce((text, span) => removeSearchSpan(text, span), raw.q ?? "");
  next.q = query === "" ? undefined : query;
  return next as Search;
}
