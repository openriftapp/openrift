import { toBoosterPrintings } from "@openrift/shared/boosters/input";
import { boosterRowsByPrinting, resolveAllBoosters } from "@openrift/shared/boosters/resolve";
import type { BoosterRow, ResolvedBooster } from "@openrift/shared/boosters/types";
import { joinCatalogPrintings } from "@openrift/shared/catalog-join";
import type { ProductCoverCard } from "@openrift/shared/contracts/products";
import { PRODUCT_COVER_CARD_COUNT } from "@openrift/shared/contracts/products";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { WellKnown } from "@openrift/shared/well-known";

import type { Repos } from "../../../deps.js";

interface BoosterIndex {
  rows: ReadonlyMap<string, BoosterRow[]>;
  covers: Record<string, ProductCoverCard[]>;
}

const built = new WeakMap<CatalogResponse, BoosterIndex>();

const COVER_OUTCOMES = ["alt-art", "epic"];

/** Battlefields are excluded: their landscape art breaks the portrait card fan. */
function coverCards(booster: ResolvedBooster): ProductCoverCard[] {
  const outcomes = booster.slots.flatMap((slot) => slot.outcomes);
  return COVER_OUTCOMES.flatMap(
    (slug) => outcomes.find((outcome) => outcome.slug === slug)?.pool ?? [],
  )
    .toSorted((a, b) => a.shortCode.localeCompare(b.shortCode))
    .flatMap(({ printingId, printing }) => {
      const imageId = printing.images[0]?.imageId;
      return imageId && !printing.card.types.includes(WellKnown.cardType.BATTLEFIELD)
        ? [{ printingId, imageId, name: printing.card.name }]
        : [];
    })
    .slice(0, PRODUCT_COVER_CARD_COUNT);
}

/** Keyed by the cached response object, which the catalog cache shares for one version across the app and its transactions. */
async function boosterIndex(repos: Pick<Repos, "catalogResponse">): Promise<BoosterIndex> {
  const { value: catalog } = await repos.catalogResponse.current();
  let index = built.get(catalog);
  if (!index) {
    const boosters = resolveAllBoosters(toBoosterPrintings(joinCatalogPrintings(catalog)));
    index = {
      rows: boosterRowsByPrinting(boosters),
      covers: Object.fromEntries(
        boosters
          .filter((booster) => booster.language === WellKnown.language.EN)
          .map((booster) => [booster.slug, coverCards(booster)]),
      ),
    };
    built.set(catalog, index);
  }
  return index;
}

export async function boosterRowsFor(
  repos: Repos,
  printingIds: readonly string[],
): Promise<BoosterRow[]> {
  const { rows } = await boosterIndex(repos);
  return printingIds.flatMap((id) => rows.get(id) ?? []);
}

export async function boosterCoverCards(repos: Repos): Promise<Record<string, ProductCoverCard[]>> {
  const { covers } = await boosterIndex(repos);
  return covers;
}
