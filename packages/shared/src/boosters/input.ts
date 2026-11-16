import type {
  DistributionChannel,
  Printing,
  PrintingDistributionChannel,
} from "../types/catalog.js";
import type { BoosterPrinting } from "./types.js";

const BOOSTER_CHANNEL = "booster";

function isBoosterChannel(link: PrintingDistributionChannel): boolean {
  return link.channel.slug === BOOSTER_CHANNEL || link.ancestorSlugs.includes(BOOSTER_CHANNEL);
}

export function boosterChannelSlugs(
  channels: readonly Pick<DistributionChannel, "id" | "slug" | "parentId">[],
): Set<string> {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  const isUnderBooster = (channel: (typeof channels)[number]): boolean => {
    let cursor: (typeof channels)[number] | undefined = channel;
    for (let depth = 0; cursor && depth < 32; depth += 1) {
      if (cursor.slug === BOOSTER_CHANNEL) {
        return true;
      }
      cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
    }
    return false;
  };
  return new Set(channels.filter((channel) => isUnderBooster(channel)).map((c) => c.slug));
}

export function toBoosterPrintings(printings: readonly Printing[]): BoosterPrinting[] {
  const sidesById = Map.groupBy(printings, (p) => p.printingId);
  const result: BoosterPrinting[] = [];
  for (const [printingId, sides] of sidesById) {
    const first = sides.find((side) => side.side === 1) ?? sides[0];
    if (!first) {
      continue;
    }
    const channels = first.distributionChannels;
    result.push({
      printingId,
      printing: first,
      setSlug: first.setSlug,
      language: first.language,
      shortCode: first.shortCode,
      rarity: first.rarity,
      finish: first.finish,
      artVariant: first.artVariant,
      size: first.size,
      isSigned: first.isSigned,
      isOvernumbered: first.isOvernumbered,
      types: [...new Set(sides.flatMap((side) => side.card.types))],
      superTypes: [...new Set(sides.flatMap((side) => side.card.superTypes))],
      hasMarker: sides.some((side) => side.markers.length > 0),
      hasChannel: channels.some((link) => !isBoosterChannel(link)),
      isPackExclusive: channels.some((link) => isBoosterChannel(link)),
    });
  }
  return result;
}
