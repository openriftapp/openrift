import { cardPrintedNamesOf } from "@openrift/shared/filters";
import type { CardSearchContext } from "@openrift/shared/filters-shared";
import type { DistributionChannelWithCount, Printing } from "@openrift/shared/types/catalog";

import type { ChannelNode } from "./promos-tree";
import { buildPromoTree } from "./promos-tree";

export function buildPromoTreeFromMatches(
  matched: Printing[],
  channels: DistributionChannelWithCount[],
): ChannelNode[] {
  const perChannel = new Map<string, Printing[]>();
  for (const printing of matched) {
    for (const link of printing.distributionChannels) {
      const list = perChannel.get(link.channel.id);
      if (list) {
        list.push(printing);
      } else {
        perChannel.set(link.channel.id, [printing]);
      }
    }
  }
  return buildPromoTree(channels, perChannel);
}

/** A promo page lists one language's printings but matches names printed in any language, as the card browser does. */
export function withCatalogPrintedNames(
  context: CardSearchContext,
  catalogPrintings: readonly Printing[] | undefined,
): CardSearchContext {
  return catalogPrintings
    ? { ...context, cardPrintedNames: cardPrintedNamesOf(catalogPrintings) }
    : context;
}
