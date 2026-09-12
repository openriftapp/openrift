import type { DeckFormatConfig } from "@openrift/shared/types/api/deck";
import type { CustomTag } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";

import { m } from "@/paraglide/messages.js";

/** A tag-locked format stores `tagSlugs` in `decks.format_config`, keyed by format slug. */
export interface FormatTagConfig {
  category: string;
  nounPlural: string;
}

interface FormatTagEntry {
  category: string;
  nounPlural: () => string;
}

const FORMAT_TAG_CONFIGS: Record<string, FormatTagEntry> = {
  [WellKnown.deckFormat.CUSTOM_REGION]: {
    category: "region",
    nounPlural: () => m.decks_format_tag_noun_region_plural(),
  },
};

export function getFormatTagConfig(format: string): FormatTagConfig | null {
  const entry = FORMAT_TAG_CONFIGS[format];
  if (!entry) {
    return null;
  }
  return { category: entry.category, nounPlural: entry.nounPlural() };
}

/** Tags that no longer resolve (admin-deleted slugs) are silently dropped; validation surfaces that separately. */
export function resolveFormatTagSummary(
  format: string,
  formatConfig: DeckFormatConfig | null,
  customTags: CustomTag[],
): string | null {
  const config = getFormatTagConfig(format);
  if (!config) {
    return null;
  }
  const tagSlugs = formatConfig?.tagSlugs ?? [];
  const labels = tagSlugs
    .map((slug) => customTags.find((tag) => tag.slug === slug)?.label)
    .filter((label): label is string => typeof label === "string");
  return labels.length === 0
    ? m.decks_format_tag_none_picked({ nounPlural: config.nounPlural })
    : labels.join(" + ");
}
