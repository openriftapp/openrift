import type { Repos } from "../../../deps.js";

interface PrintingRefFields {
  language?: string | null;
  rarity?: string | null;
  artVariant?: string | null;
  finish?: string | null;
  size?: string | null;
  markerSlugs?: readonly string[] | null;
  distributionChannelSlugs?: readonly string[] | null;
}

export interface UnknownPrintingRef {
  field: string;
  value: string;
}

export interface KnownPrintingRefs {
  languages: readonly string[];
  rarities: readonly string[];
  artVariants: readonly string[];
  finishes: readonly string[];
  cardSizes: readonly string[];
  markers: readonly string[];
  distributionChannels: readonly string[];
}

export async function loadKnownPrintingRefs(
  repos: Pick<Repos, "enums" | "distributionChannels">,
  distributionChannelSlugs: readonly string[],
): Promise<KnownPrintingRefs> {
  const [enums, channels] = await Promise.all([
    repos.enums.all(),
    repos.distributionChannels.listBySlugs([...new Set(distributionChannelSlugs)]),
  ]);
  return {
    languages: enums.languages.map((row) => row.slug),
    rarities: enums.rarities.map((row) => row.slug),
    artVariants: enums.artVariants.map((row) => row.slug),
    finishes: enums.finishes.map((row) => row.slug),
    cardSizes: enums.cardSizes.map((row) => row.slug),
    markers: enums.markers.map((row) => row.slug),
    distributionChannels: channels.map((row) => row.slug),
  };
}

export function knownRarity(known: KnownPrintingRefs, rarity: string): string | undefined {
  return known.rarities.find((slug) => slug.toLowerCase() === rarity.toLowerCase());
}

export function unknownPrintingRefs(
  fields: PrintingRefFields,
  known: KnownPrintingRefs,
): UnknownPrintingRef[] {
  const unknown: UnknownPrintingRef[] = [];

  const single: [string, string | null | undefined, (value: string) => boolean][] = [
    ["language", fields.language, (value) => known.languages.includes(value)],
    ["rarity", fields.rarity, (value) => knownRarity(known, value) !== undefined],
    ["art variant", fields.artVariant, (value) => known.artVariants.includes(value)],
    ["finish", fields.finish, (value) => known.finishes.includes(value)],
    ["size", fields.size, (value) => known.cardSizes.includes(value)],
  ];
  for (const [field, value, isKnown] of single) {
    if (value && !isKnown(value)) {
      unknown.push({ field, value });
    }
  }

  const many: [string, readonly string[] | null | undefined, readonly string[]][] = [
    ["marker", fields.markerSlugs, known.markers],
    ["distribution channel", fields.distributionChannelSlugs, known.distributionChannels],
  ];
  for (const [field, values, allowed] of many) {
    for (const value of values ?? []) {
      if (!allowed.includes(value)) {
        unknown.push({ field, value });
      }
    }
  }

  return unknown;
}

export function describeUnknownRefs(unknown: readonly UnknownPrintingRef[]): string {
  return `not on an admin list: ${unknown.map((ref) => `${ref.field} "${ref.value}"`).join(", ")}`;
}
