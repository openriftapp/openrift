import type { AvailableFilters } from "@openrift/shared/filters-available";
import type { SearchVocabulary } from "@openrift/shared/search-query/bind";

import { useCatalogSearchVocabulary } from "@/features/cards/hooks/use-catalog-search-vocabulary";
import { useVisibleFilterDimensions } from "@/features/cards/hooks/use-filter-dimensions";
import type { QueryFilterOptions } from "@/features/cards/lib/query-filters";
import { useCustomTagList } from "@/hooks/use-enums";

interface QueryFilterSurface {
  availableFilters: AvailableFilters;
  availableLanguages?: string[];
  hiddenSections?: ReadonlySet<string>;
  visibleCustomTagCategories?: ReadonlySet<string>;
  ownedCountMax?: number;
}

const NO_VOCABULARY: SearchVocabulary = {};
const NO_LANGUAGES: readonly string[] = [];

export function useQueryFilterOptions(surface: QueryFilterSurface): QueryFilterOptions {
  const visible = useVisibleFilterDimensions(surface);
  const vocabulary = useCatalogSearchVocabulary() ?? NO_VOCABULARY;
  const { all: customTags } = useCustomTagList();
  const { availableFilters } = surface;
  return {
    vocabulary,
    visible,
    values: {
      sets: availableFilters.sets,
      languages: surface.availableLanguages ?? NO_LANGUAGES,
      rarities: availableFilters.rarities,
      types: availableFilters.types,
      superTypes: availableFilters.superTypes,
      domains: availableFilters.domains,
      artVariants: availableFilters.artVariants,
      finishes: availableFilters.finishes,
      cardSizes: availableFilters.cardSizes,
      markers: availableFilters.markers.map((marker) => marker.slug),
      channels: availableFilters.distributionChannels.map((channel) => channel.slug),
      customTags: customTags.map((tag) => tag.slug),
      keywords: availableFilters.keywords,
      tags: availableFilters.tags,
    },
    nullableRanges: new Set([
      ...(availableFilters.hasNullEnergy ? ["energy"] : []),
      ...(availableFilters.hasNullPower ? ["power"] : []),
    ]),
  };
}
