import { toBoosterPrintings } from "@openrift/shared/boosters/input";
import { boosterRowsByPrinting, resolveAllBoosters } from "@openrift/shared/boosters/resolve";
import type { BoosterRow, ResolvedBooster } from "@openrift/shared/boosters/types";
import { joinCatalogPrintings } from "@openrift/shared/catalog-join";
import type { ProductCoverCard } from "@openrift/shared/contracts/products";
import { PRODUCT_COVER_CARD_COUNT } from "@openrift/shared/contracts/products";
import { WellKnown } from "@openrift/shared/well-known";

import type { Repos } from "../../../deps.js";

interface BoosterIndex {
  rows: ReadonlyMap<string, BoosterRow[]>;
  covers: Record<string, ProductCoverCard[]>;
}

const built = new WeakMap<Repos, { version: string; index: BoosterIndex }>();

const COVER_OUTCOMES = ["alt-art", "epic"];

// Battlefields are excluded: their landscape art breaks the portrait card fan.
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

async function boosterIndex(repos: Repos): Promise<BoosterIndex> {
  const { version, value: catalog } = await repos.catalogResponse.current();
  let entry = built.get(repos);
  if (entry?.version !== version) {
    const boosters = resolveAllBoosters(toBoosterPrintings(joinCatalogPrintings(catalog)));
    entry = {
      version,
      index: {
        rows: boosterRowsByPrinting(boosters),
        covers: Object.fromEntries(
          boosters
            .filter((booster) => booster.language === WellKnown.language.EN)
            .map((booster) => [booster.slug, coverCards(booster)]),
        ),
      },
    };
    built.set(repos, entry);
  }
  return entry.index;
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
