import { enumLabel } from "@openrift/shared/enum-label";
import type { AvailableFilters } from "@openrift/shared/filters-available";
import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import type { SearchKeyId } from "@openrift/shared/search-query/keys";

import type { SearchValueLabeler } from "@/features/cards/lib/search-clause-labels";
import { useEnumOrders, useFormatList, useLanguageLabels } from "@/hooks/use-enums";

interface SearchVocabularies {
  validation: SearchVocabulary;
  suggestions: SearchVocabulary;
  valueLabel: SearchValueLabeler;
}

export function useSearchVocabulary(
  availableFilters: AvailableFilters,
  availableLanguages: readonly string[],
): SearchVocabularies {
  const { labels } = useEnumOrders();
  const languageLabels = useLanguageLabels();
  const formats = useFormatList();

  const validation: SearchVocabulary = {
    domain: availableFilters.domains,
    rarity: availableFilters.rarities,
    set: availableFilters.sets,
    lang: availableLanguages,
    in: [...availableFilters.sets, ...availableLanguages],
    marker: availableFilters.markers.map((marker) => marker.slug),
    channel: availableFilters.distributionChannels.map((channel) => channel.slug),
    format: [...formats.names, ...formats.ids],
    banned: [...formats.names, ...formats.ids],
  };
  const suggestions: SearchVocabulary = {
    ...validation,
    format: formats.names,
    banned: formats.names,
    type: [...availableFilters.types, ...availableFilters.superTypes],
    keyword: availableFilters.keywords,
    otag: availableFilters.tags,
  };

  const valueLabel = (key: SearchKeyId, value: string): string => {
    switch (key) {
      case "domain": {
        return value
          .split(",")
          .map((domain) => enumLabel(labels.domains, domain))
          .join(", ");
      }
      case "rarity": {
        return enumLabel(labels.rarities, value);
      }
      case "format":
      case "banned": {
        return enumLabel(formats.labels, value);
      }
      case "lang": {
        return enumLabel(languageLabels, value.toUpperCase());
      }
      case "type": {
        return enumLabel({ ...labels.superTypes, ...labels.cardTypes }, value.toLowerCase());
      }
      default: {
        return value;
      }
    }
  };

  return { validation, suggestions, valueLabel };
}
