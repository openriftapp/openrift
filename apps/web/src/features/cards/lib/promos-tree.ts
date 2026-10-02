import type { DistributionChannelWithCount, Printing } from "@openrift/shared/types/catalog";

export interface ChannelNode {
  channel: DistributionChannelWithCount;
  children: ChannelNode[];
  printings: Printing[];
  subtreePrintingIds: Set<string>;
  localPrintingCount: number;
}

/**
 * Parent counts are the union of descendant printing ids, so a printing
 * linked to multiple channels in the same subtree is only counted once.
 */
export function buildPromoTree(
  channels: DistributionChannelWithCount[],
  printingsByChannelId: Map<string, Printing[]>,
): ChannelNode[] {
  const byParent = new Map<string | null, DistributionChannelWithCount[]>();
  for (const channel of channels) {
    const list = byParent.get(channel.parentId);
    if (list) {
      list.push(channel);
    } else {
      byParent.set(channel.parentId, [channel]);
    }
  }
  function build(parentId: string | null): ChannelNode[] {
    const siblings = byParent.get(parentId);
    if (!siblings) {
      return [];
    }
    return siblings.map((channel) => {
      const children = build(channel.id);
      const printings = printingsByChannelId.get(channel.id) ?? [];
      const subtreePrintingIds = new Set<string>();
      for (const printing of printings) {
        subtreePrintingIds.add(printing.id);
      }
      for (const child of children) {
        for (const id of child.subtreePrintingIds) {
          subtreePrintingIds.add(id);
        }
      }
      return {
        channel,
        children,
        printings,
        subtreePrintingIds,
        localPrintingCount: subtreePrintingIds.size,
      };
    });
  }
  return build(null);
}
