import type { CompareOptionSets } from "@/features/catalog-admin/lib/compare-rows";
import { useDistributionChannels } from "@/hooks/use-distribution-channels";
import { useEnumOrders } from "@/hooks/use-enums";
import { useLanguages } from "@/hooks/use-languages";
import { useMarkers } from "@/hooks/use-markers";

export function useCompareOptionSets(): CompareOptionSets {
  const { orders } = useEnumOrders();
  const { data: markersData } = useMarkers();
  const { data: channelsData } = useDistributionChannels();
  const { data: languagesData } = useLanguages();

  return {
    types: orders.cardTypes,
    superTypes: orders.superTypes,
    domains: orders.domains,
    rarity: orders.rarities,
    artVariant: orders.artVariants,
    finish: orders.finishes,
    size: orders.cardSizes,
    markerSlugs: markersData.markers.map((marker) => marker.slug),
    distributionChannelSlugs: channelsData.distributionChannels.map((channel) => channel.slug),
    language: languagesData.languages.map((language) => language.code),
  };
}
