import { labelMap } from "@openrift/shared/enum-label";

import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";

export function useValueLabels(): PrintingValueLabels {
  const { labels } = useEnumOrders();
  const languages = useLanguageLabels();
  const { data: markerData } = useMarkers();
  const { data: channelData } = useDistributionChannels();
  return {
    rarities: labels.rarities,
    finishes: labels.finishes,
    artVariants: labels.artVariants,
    cardSizes: labels.cardSizes,
    languages,
    markers: labelMap(markerData.markers),
    channels: labelMap(
      [...buildChannelBreadcrumbsBySlug(channelData.distributionChannels)].map(([slug, label]) => ({
        slug,
        label,
      })),
    ),
  };
}
