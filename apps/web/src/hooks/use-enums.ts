import { labelMap } from "@openrift/shared/enum-label";
import type { LabelMap } from "@openrift/shared/enum-label";
import { DEFAULT_RARITY_COLORS } from "@openrift/shared/rarity-colors";
import { formatSearchSlug } from "@openrift/shared/search-query/keys";
import type { ColoredEnumRow, EnumRow, InitResponse } from "@openrift/shared/types/api/init";
import type { CustomTag, DistributionChannel } from "@openrift/shared/types/catalog";
import type { DeckZone, EnumOrders } from "@openrift/shared/types/enums";
import { useSuspenseQuery } from "@tanstack/react-query";

import type { EnumLabels } from "@/lib/enum-labels";
import { initQueryOptions } from "@/lib/init-queries";

function sorted<T extends EnumRow>(rows: readonly T[]): T[] {
  return rows.toSorted((a, b) => a.sortOrder - b.sortOrder);
}

function slugs(rows: readonly EnumRow[]): string[] {
  return sorted(rows).map((row) => row.slug);
}

function sortedLabelMap(rows: readonly EnumRow[]): LabelMap {
  return labelMap(sorted(rows));
}

function colorMap(rows: readonly ColoredEnumRow[]): Record<string, string> {
  return Object.fromEntries(
    rows.flatMap((row) => (row.color === null ? [] : [[row.slug, row.color] as const])),
  );
}

function bySortOrderThenLabel(
  a: { sortOrder: number; label: string },
  b: { sortOrder: number; label: string },
): number {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
}

const derive = {
  zoneOrder: (data: InitResponse): { zoneOrder: DeckZone[]; zoneLabels: LabelMap } => {
    const zones = sorted(data.enums.deckZones);
    return { zoneOrder: zones.map((zone) => zone.slug as DeckZone), zoneLabels: labelMap(zones) };
  },
  languageLabels: (data: InitResponse): LabelMap => sortedLabelMap(data.enums.languages),
  languageList: (data: InitResponse): { code: string; name: string; color: string | null }[] =>
    sorted(data.enums.languages).map((row) => ({
      code: row.slug,
      name: row.label,
      color: row.color,
    })),
  languageColors: (data: InitResponse): Record<string, string> => colorMap(data.enums.languages),
  deckFormatList: (
    data: InitResponse,
  ): { formats: { slug: string; label: string }[]; labels: LabelMap } => {
    const rows = sorted(data.enums.deckFormats);
    return {
      formats: rows.map((row) => ({ slug: row.slug, label: row.label })),
      labels: labelMap(rows),
    };
  },
  formatList: (data: InitResponse): { names: string[]; ids: string[]; labels: LabelMap } => {
    const rows = sorted(data.enums.formats);
    const names = rows.map((row) => formatSearchSlug(row.label));
    return {
      names,
      ids: rows.map((row) => row.slug),
      labels: labelMap(
        rows.flatMap((row, index) => [
          { slug: row.slug, label: row.label },
          { slug: names[index] ?? row.slug, label: row.label },
        ]),
      ),
    };
  },
  conditionList: (data: InitResponse): { slug: string; label: string }[] =>
    sorted(data.enums.conditions).map((row) => ({ slug: row.slug, label: row.label })),
  graderList: (data: InitResponse): { slug: string; label: string }[] =>
    sorted(data.enums.graders).map((row) => ({ slug: row.slug, label: row.label })),
  markerList: (data: InitResponse): { slug: string; label: string; description: string | null }[] =>
    sorted(data.enums.markers).map((row) => ({
      slug: row.slug,
      label: row.label,
      description: row.description,
    })),
  championIdentifierTags: (data: InitResponse): ReadonlySet<string> =>
    new Set(data.championIdentifierTags),
  customTagList: (
    data: InitResponse,
  ): { byCategory: Map<string, CustomTag[]>; all: CustomTag[] } => {
    const all = data.customTags.toSorted(bySortOrderThenLabel);
    return { byCategory: Map.groupBy(all, (tag) => tag.category), all };
  },
  tagCategories: (
    data: InitResponse,
  ): {
    categories: { slug: string; label: string; sortOrder: number }[];
    categoryByTag: ReadonlyMap<string, string>;
  } => ({
    categories: data.tagCategories.toSorted(bySortOrderThenLabel),
    categoryByTag: new Map(Object.entries(data.tagCategoryMap)),
  }),
  enumOrders: (
    data: InitResponse,
  ): { orders: EnumOrders; labels: EnumLabels; rarityColors: Record<string, string> } => {
    // Keep the contract's per-key typing: widening to an index signature would
    // let a typo'd key compile and produce a silently empty label map.
    const d = data.enums;
    return {
      orders: {
        finishes: slugs(d.finishes),
        rarities: slugs(d.rarities),
        domains: slugs(d.domains),
        cardTypes: slugs(d.cardTypes),
        superTypes: slugs(d.superTypes),
        artVariants: slugs(d.artVariants),
        cardSizes: slugs(d.cardSizes),
      },
      labels: {
        finishes: sortedLabelMap(d.finishes),
        rarities: sortedLabelMap(d.rarities),
        domains: sortedLabelMap(d.domains),
        cardTypes: sortedLabelMap(d.cardTypes),
        superTypes: sortedLabelMap(d.superTypes),
        artVariants: sortedLabelMap(d.artVariants),
        cardSizes: sortedLabelMap(d.cardSizes),
        conditions: sortedLabelMap(d.conditions),
        graders: sortedLabelMap(d.graders),
      },
      rarityColors: { ...DEFAULT_RARITY_COLORS, ...colorMap(d.rarities) },
    };
  },
};

type EnumView = { [K in keyof typeof derive]: ReturnType<(typeof derive)[K]> };

const views = new WeakMap<InitResponse, Partial<EnumView>>();

/** Each part is derived on first read and shared by every component that reads the same init data. */
function enumView<K extends keyof EnumView>(data: InitResponse, key: K): EnumView[K] {
  let view = views.get(data);
  if (!view) {
    view = {};
    views.set(data, view);
  }
  const cached = view[key];
  if (cached !== undefined) {
    return cached;
  }
  const value = derive[key](data) as EnumView[K];
  view[key] = value;
  return value;
}

function useEnumView<K extends keyof EnumView>(key: K): EnumView[K] {
  const { data } = useSuspenseQuery(initQueryOptions);
  return enumView(data, key);
}

export function useZoneOrder(): { zoneOrder: DeckZone[]; zoneLabels: LabelMap } {
  return useEnumView("zoneOrder");
}

export function useLanguageLabels(): LabelMap {
  return useEnumView("languageLabels");
}

export function useLanguageList(): { code: string; name: string; color: string | null }[] {
  return useEnumView("languageList");
}

/** Omits codes with no color set. */
export function useLanguageColors(): Record<string, string> {
  return useEnumView("languageColors");
}

export function useDeckFormatList(): {
  formats: { slug: string; label: string }[];
  labels: LabelMap;
} {
  return useEnumView("deckFormatList");
}

/** Ban formats (`f:` and `banned:` in search), not the deck builder's formats. */
export function useFormatList(): { names: string[]; ids: string[]; labels: LabelMap } {
  return useEnumView("formatList");
}

/** Ordered best-to-worst: Mint → Poor. */
export function useConditionList(): { slug: string; label: string }[] {
  return useEnumView("conditionList");
}

export function useGraderList(): { slug: string; label: string }[] {
  return useEnumView("graderList");
}

export function useMarkerList(): { slug: string; label: string; description: string | null }[] {
  return useEnumView("markerList");
}

/**
 * Includes parents that no printing links to directly. Distinct from the
 * admin-only `useDistributionChannels` to avoid import-site collisions.
 */
export function useChannelRegistry(): DistributionChannel[] {
  const { data } = useSuspenseQuery(initQueryOptions);
  return data.distributionChannels;
}

/** Competitive circuits with their own ban list or set dates, in admin order. */
export function useCircuitList(): InitResponse["circuits"] {
  const { data } = useSuspenseQuery(initQueryOptions);
  return data.circuits;
}

export function useChampionIdentifierTags(): ReadonlySet<string> {
  return useEnumView("championIdentifierTags");
}

export function useCustomTagList(): { byCategory: Map<string, CustomTag[]>; all: CustomTag[] } {
  return useEnumView("customTagList");
}

/** Tags absent from the map are unclassified. */
export function useTagCategories(): {
  categories: { slug: string; label: string; sortOrder: number }[];
  categoryByTag: ReadonlyMap<string, string>;
} {
  return useEnumView("tagCategories");
}

export function useEnumOrders(): {
  orders: EnumOrders;
  labels: EnumLabels;
  rarityColors: Record<string, string>;
} {
  return useEnumView("enumOrders");
}
