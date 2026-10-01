import type { Logger } from "@openrift/shared/logger";
import type { Marketplace } from "@openrift/shared/types/pricing";

import type { Repos } from "../../../../deps.js";

export interface CrossRefCandidate {
  externalId: number;
  groupId: number;
  productName: string;
  tcgplayerIds: readonly number[];
  cardmarketIds: readonly number[];
  observed: readonly { finish: string; language: string }[];
}

interface CrossRefEntry {
  printingId: string;
  finish: string;
}

type PriceMatchPrinting = Awaited<
  ReturnType<Repos["priceRefresh"]["allPrintingsForPriceMatch"]>
>[number];

function printingIdentity(p: PriceMatchPrinting): string {
  const slugKey = [...p.markerSlugs].sort().join(",");
  return `${p.cardId}|${p.setId}|${p.shortCode}|${p.finish}|${p.artVariant}|${p.isSigned}|${p.isOvernumbered}|${slugKey}`;
}

/**
 * Binds a language-keyed marketplace's SKUs to printings through the product's
 * TCGplayer and Cardmarket ids. Those ids land on the English printing, so each
 * observed language resolves to that printing's sibling in the same language;
 * a language with no sibling printing stays unmatched.
 */
export async function autoMatchByCrossReference(
  repos: Repos,
  marketplace: Marketplace,
  candidates: readonly CrossRefCandidate[],
  log: Logger,
): Promise<number> {
  const existingSources = await repos.priceRefresh.existingSourcesByMarketplaces([
    "tcgplayer",
    "cardmarket",
  ]);

  const allPrintings = await repos.priceRefresh.allPrintingsForPriceMatch();
  const siblingByIdentity = new Map<string, Map<string, string>>();
  const identityByPrintingId = new Map<string, string>();
  for (const p of allPrintings) {
    const identity = printingIdentity(p);
    identityByPrintingId.set(p.id, identity);
    let byLanguage = siblingByIdentity.get(identity);
    if (!byLanguage) {
      byLanguage = new Map<string, string>();
      siblingByIdentity.set(identity, byLanguage);
    }
    if (!byLanguage.has(p.language)) {
      byLanguage.set(p.language, p.id);
    }
  }

  const tcgLookup = new Map<number, CrossRefEntry[]>();
  const cmLookup = new Map<number, CrossRefEntry[]>();
  for (const src of existingSources) {
    const lookup = src.marketplace === "tcgplayer" ? tcgLookup : cmLookup;
    const list = lookup.get(src.externalId) ?? [];
    list.push({ printingId: src.printingId, finish: src.finish });
    lookup.set(src.externalId, list);
  }

  // Skipping per (externalId, finish, language) lets a new language land on a
  // product whose other languages are already bound.
  const existingOwnSources = await repos.priceRefresh.existingSourcesByMarketplaces([marketplace]);
  const existingKeys = new Set(
    existingOwnSources.map((s) => `${s.externalId}::${s.finish}::${s.language ?? ""}`),
  );

  const toInsert: Parameters<Repos["priceRefresh"]["batchInsertProductVariants"]>[0] = [];
  const emitted = new Set<string>();

  for (const candidate of candidates) {
    const crossRefVariants =
      candidate.tcgplayerIds.map((id) => tcgLookup.get(id)).find(Boolean) ??
      candidate.cardmarketIds.map((id) => cmLookup.get(id)).find(Boolean);
    if (!crossRefVariants) {
      continue;
    }

    const identityByFinish = new Map<string, string>();
    for (const variant of crossRefVariants) {
      const identity = identityByPrintingId.get(variant.printingId);
      if (identity && !identityByFinish.has(variant.finish)) {
        identityByFinish.set(variant.finish, identity);
      }
    }

    for (const { finish, language } of candidate.observed) {
      const identity = identityByFinish.get(finish);
      if (!identity) {
        continue;
      }
      const sibling = siblingByIdentity.get(identity)?.get(language);
      if (!sibling) {
        continue;
      }
      const key = `${candidate.externalId}::${finish}::${language}`;
      if (emitted.has(key) || existingKeys.has(key)) {
        continue;
      }
      emitted.add(key);
      toInsert.push({
        marketplace,
        externalId: candidate.externalId,
        groupId: candidate.groupId,
        productName: candidate.productName,
        printingId: sibling,
        finish,
        language,
      });
    }
  }

  if (toInsert.length === 0) {
    return 0;
  }

  const BATCH_SIZE = 200;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    await repos.priceRefresh.batchInsertProductVariants(toInsert.slice(i, i + BATCH_SIZE));
  }

  log.info(`Auto-matched ${toInsert.length} ${marketplace} variants to existing printings`);
  return toInsert.length;
}
