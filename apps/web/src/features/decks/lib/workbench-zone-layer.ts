import type { DeckZoneFilterPreset } from "@/features/decks/lib/deck-zone-filters";

type PresetArrayKey = keyof DeckZoneFilterPreset["arrayFilters"];

export interface ZoneChip {
  key: string;
  kind: PresetArrayKey | "search" | "stats";
  value: string;
}

type IncludeKey = Exclude<PresetArrayKey, "superTypesEx">;
type IncludeField = "types" | "superTypes" | "domains" | "customTagSlugs";

const INCLUDE_KEYS: IncludeKey[] = ["types", "superTypes", "domains", "customTags"];

export function zoneLayerChips(preset: DeckZoneFilterPreset): ZoneChip[] {
  const chips: ZoneChip[] = [];
  for (const kind of [...INCLUDE_KEYS, "superTypesEx"] satisfies PresetArrayKey[]) {
    for (const value of preset.arrayFilters[kind]) {
      chips.push({ key: `${kind}:${value}`, kind, value });
    }
  }
  if (preset.search) {
    chips.push({ key: `search:${preset.search}`, kind: "search", value: preset.search });
  }
  if (preset.clearStatRanges) {
    chips.push({ key: "stats", kind: "stats", value: "" });
  }
  return chips;
}

interface RangeFilter {
  min: number | null;
  max: number | null;
}

interface LayerableFilters {
  search: string;
  types: string[];
  superTypes: string[];
  superTypesExclude: string[];
  domains: string[];
  customTagSlugs: string[];
  energy: RangeFilter;
  might: RangeFilter;
  power: RangeFilter;
}

const FIELD: Record<IncludeKey, IncludeField> = {
  types: "types",
  superTypes: "superTypes",
  domains: "domains",
  customTags: "customTagSlugs",
};

const NO_RANGE: RangeFilter = { min: null, max: null };

export const NO_MATCH = "__no-match__";

export function applyZoneLayer<F extends LayerableFilters>(
  filters: F,
  preset: DeckZoneFilterPreset,
  removed: ReadonlySet<string>,
): F {
  const active = zoneLayerChips(preset).filter((chip) => !removed.has(chip.key));
  const next: Partial<LayerableFilters> = {};
  const byKind = Map.groupBy(active, (chip) => chip.kind);

  for (const kind of INCLUDE_KEYS) {
    const zoneValues = (byKind.get(kind) ?? []).map((chip) => chip.value);
    if (zoneValues.length === 0) {
      continue;
    }
    const field = FIELD[kind];
    const userValues = filters[field];
    const overlap = userValues.filter((value) => zoneValues.includes(value));
    // An empty list means "no filter", so a disjoint pair needs a value no card has.
    next[field] = userValues.length === 0 ? zoneValues : overlap.length > 0 ? overlap : [NO_MATCH];
  }

  const excluded = (byKind.get("superTypesEx") ?? []).map((chip) => chip.value);
  if (excluded.length > 0) {
    next.superTypesExclude = [...new Set([...filters.superTypesExclude, ...excluded])];
  }

  const zoneSearch = byKind.get("search")?.[0]?.value;
  if (zoneSearch) {
    next.search = [filters.search, zoneSearch].filter(Boolean).join(" ");
  }

  if (byKind.has("stats")) {
    next.energy = NO_RANGE;
    next.might = NO_RANGE;
    next.power = NO_RANGE;
  }
  return { ...filters, ...next };
}
