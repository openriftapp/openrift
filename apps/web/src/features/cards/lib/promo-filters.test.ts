import { filterCards } from "@openrift/shared/filters";
import { cardSearchContext } from "@openrift/shared/filters-shared";
import type {
  DistributionChannelWithCount,
  PrintingDistributionChannel,
} from "@openrift/shared/types/catalog";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { buildPromoTreeFromMatches, withCatalogPrintedNames } from "./promo-filters";

function makeChannel(
  overrides: Partial<DistributionChannelWithCount> = {},
): DistributionChannelWithCount {
  return {
    id: overrides.id ?? "ch-id",
    slug: overrides.slug ?? "ch",
    label: overrides.label ?? "Channel",
    description: null,
    kind: "event",
    parentId: null,
    childrenLabel: null,
    cardCount: 1,
    printingCount: 1,
    ...overrides,
  };
}

function makeChannelLink(channelId: string): PrintingDistributionChannel {
  return {
    channel: {
      id: channelId,
      slug: channelId,
      label: channelId,
      description: null,
      kind: "event",
      parentId: null,
      childrenLabel: null,
    },
    distributionNote: null,
    ancestorLabels: [],
  };
}

describe("buildPromoTreeFromMatches", () => {
  it("groups printings under each channel they link to and builds a tree", () => {
    const channels = [
      makeChannel({ id: "root", slug: "root", label: "Root" }),
      makeChannel({ id: "leaf", slug: "leaf", label: "Leaf", parentId: "root" }),
    ];
    const printings = [
      stubPrinting({ printingId: "p1", distributionChannels: [makeChannelLink("leaf")] }),
      stubPrinting({ printingId: "p2", distributionChannels: [makeChannelLink("leaf")] }),
    ];
    const tree = buildPromoTreeFromMatches(printings, channels);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.channel.id).toBe("root");
    expect(tree[0]!.subtreePrintingIds.size).toBe(2);
    expect(tree[0]!.children[0]!.printings.map((p) => p.printingId)).toEqual(["p1", "p2"]);
  });

  it("returns empty leaves when no printings match", () => {
    const channels = [makeChannel({ id: "root", slug: "root", label: "Root" })];
    const tree = buildPromoTreeFromMatches([], channels);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.subtreePrintingIds.size).toBe(0);
  });
});

describe("withCatalogPrintedNames", () => {
  const promo = stubPrinting({
    cardId: "card-annie",
    language: "FR",
    printedName: "Annie la Flamboyante",
    card: { name: "Annie, Fiery" },
  });
  const german = stubPrinting({
    cardId: "card-annie",
    language: "DE",
    printedName: "Annie die Feurige",
    card: { name: "Annie, Fiery" },
  });
  const filters = { ...EMPTY_CARD_FILTERS, languages: ["FR"], search: "Feurige" };
  const base = cardSearchContext({
    vocabulary: undefined,
    keywordReverseMap: undefined,
    customTagAssignments: undefined,
    rarityOrder: undefined,
  });

  it("finds a promo by a name printed in another language", () => {
    const context = withCatalogPrintedNames(base, [promo, german]);
    expect(filterCards([promo], filters, context)).toEqual([promo]);
  });

  it("matches only the page's own printings before the catalog loads", () => {
    expect(filterCards([promo], filters, withCatalogPrintedNames(base, undefined))).toEqual([]);
  });
});
