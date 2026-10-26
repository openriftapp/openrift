import type { EnumRow } from "@openrift/shared/types/api/init";
import type { KeywordEntry } from "@openrift/shared/types/api/keyword";
import type { DistributionChannel, DistributionChannelKind } from "@openrift/shared/types/catalog";

interface KeywordRow {
  name: string;
  color: string;
  darkText: boolean;
  costKeyword: boolean;
  cardModifier: boolean;
}

interface KeywordTranslationRow {
  keywordName: string;
  language: string;
  label: string;
}

export function toKeywordEntries(
  rows: readonly KeywordRow[],
  translations: readonly KeywordTranslationRow[],
): Record<string, KeywordEntry> {
  const entries: Record<string, KeywordEntry> = {};
  for (const row of rows) {
    entries[row.name] = {
      color: row.color,
      darkText: row.darkText,
      costKeyword: row.costKeyword,
      cardModifier: row.cardModifier,
    };
  }
  for (const translation of translations) {
    const entry = entries[translation.keywordName];
    if (entry) {
      entry.translations ??= {};
      entry.translations[translation.language] = translation.label;
    }
  }
  return entries;
}

export function toEnumRows(rows: readonly EnumRow[]): EnumRow[] {
  return rows.map(({ slug, label, sortOrder }) => ({ slug, label, sortOrder }));
}

export function toDistributionChannel(row: {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  kind: string;
  parentId: string | null;
  childrenLabel: string | null;
}): DistributionChannel {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    kind: row.kind as DistributionChannelKind,
    parentId: row.parentId,
    childrenLabel: row.childrenLabel,
  };
}

export function toTagCategoryMap(
  rows: readonly { tag: string; category: string }[],
): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.tag, row.category]));
}
