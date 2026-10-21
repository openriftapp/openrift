import {
  computeProductSuggestions,
  productSuggestionKey,
  STRONG_MATCH_THRESHOLD,
} from "@openrift/shared/marketplace-suggestions";
import type { UnifiedMappingGroupResponse } from "@openrift/shared/types/api/admin";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";

import type { Repos } from "../../../deps.js";
import { createMarketplaceConfigs } from "../lib/marketplace-configs.js";
import type {
  UnassignedListing,
  UnassignedListings,
  UnmatchedListing,
} from "../lib/unassigned-listings.js";
import { buildCardIndex, getMappingOverview, matchStagedProducts } from "./marketplace-mapping.js";
import { buildUnifiedMappingsFromRows } from "./unified-mapping-merge.js";

type ListingRow = Awaited<ReturnType<Repos["marketplaceMapping"]["unassignedListings"]>>[number];

function toListing(row: ListingRow): UnassignedListing {
  return {
    marketplace: row.marketplace,
    externalId: row.externalId,
    finish: row.finish,
    language: row.language,
    productName: row.productName,
    createdAt: row.createdAt,
  };
}

function rowKey(row: ListingRow): string {
  return productSuggestionKey(row.marketplace, row.externalId, row.finish, row.language);
}

function listingsFromGroup(
  group: UnifiedMappingGroupResponse,
  rowByKey: ReadonlyMap<string, ListingRow>,
): UnassignedListings {
  const suggestions = computeProductSuggestions(group);
  const printingById = new Map(group.printings.map((printing) => [printing.printingId, printing]));
  const out: UnassignedListings = { suggested: [], unmatched: [] };
  for (const marketplace of ALL_MARKETPLACES) {
    for (const product of group[marketplace].stagedProducts) {
      const key = productSuggestionKey(
        marketplace,
        product.externalId,
        product.finish,
        product.language,
      );
      const row = rowByKey.get(key);
      if (row === undefined) {
        continue;
      }
      const strong = (suggestions.get(key) ?? []).filter(
        (suggestion) => suggestion.isWeak !== true && printingById.has(suggestion.printingId),
      );
      if (strong.length === 0) {
        out.unmatched.push({
          ...toListing(row),
          card: { slug: group.cardSlug, name: group.cardName },
        });
      }
      for (const suggestion of strong) {
        const printing = printingById.get(suggestion.printingId);
        out.suggested.push({
          ...toListing(row),
          printingId: suggestion.printingId,
          printingLabel: [printing?.shortCode, printing?.finish, printing?.language].join(" "),
          cardSlug: group.cardSlug,
          cardName: group.cardName,
          score: suggestion.score,
          strength: suggestion.score >= STRONG_MATCH_THRESHOLD ? "strong" : "suggested",
        });
      }
    }
  }
  return out;
}

export async function listUnassignedListings(repos: Repos): Promise<UnassignedListings> {
  const repo = repos.marketplaceMapping;
  const [rows, cardNames] = await Promise.all([repo.unassignedListings(), repo.allCardNames()]);

  const { cardNames: nameIndex } = buildCardIndex([], cardNames);
  const cardIds = new Set(cardNames.map((card) => card.cardId));
  const touchedCardIds = new Set<string>();
  const nameless: UnmatchedListing[] = [];

  for (const marketplaceRows of Map.groupBy(rows, (row) => row.marketplace).values()) {
    const overrideMap = new Map<string, { cardId: string }>();
    for (const row of marketplaceRows) {
      if (row.overrideCardId !== null) {
        overrideMap.set(`${row.externalId}::${row.finish}::${row.language}`, {
          cardId: row.overrideCardId,
        });
      }
    }
    const { stagedByCard, matchedStagingKeys } = matchStagedProducts(
      marketplaceRows,
      cardIds,
      nameIndex,
      overrideMap,
    );
    for (const cardId of stagedByCard.keys()) {
      touchedCardIds.add(cardId);
    }
    for (const row of marketplaceRows) {
      if (!matchedStagingKeys.has(`${row.externalId}::${row.finish}::${row.language}`)) {
        nameless.push({ ...toListing(row), card: null });
      }
    }
  }

  const unifiedRows = await repo.allCardsWithPrintingsUnified([...touchedCardIds]);
  const { groups } = await buildUnifiedMappingsFromRows(
    repos,
    createMarketplaceConfigs(repos),
    getMappingOverview,
    unifiedRows,
    cardNames,
  );

  const rowByKey = new Map(rows.map((row) => [rowKey(row), row]));
  const perGroup = groups.map((group) => listingsFromGroup(group, rowByKey));
  return {
    suggested: perGroup.flatMap((entry) => entry.suggested),
    unmatched: [...perGroup.flatMap((entry) => entry.unmatched), ...nameless],
  };
}
