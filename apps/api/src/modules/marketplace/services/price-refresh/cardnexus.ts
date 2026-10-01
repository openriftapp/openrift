import type { Logger } from "@openrift/shared/logger";
import type { PriceRefreshResponse } from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";

import type { Repos } from "../../../../deps.js";
import type { Fetch } from "../../../../io.js";
import type { LoadedIgnoredKeys } from "../../repositories/price-refresh.js";
import type { CrossRefCandidate } from "./cross-ref-match.js";
import { autoMatchByCrossReference } from "./cross-ref-match.js";
import { fetchJson } from "./fetch.js";
import { logFetchSummary, logUpsertCounts } from "./log.js";
import type { GroupRow, PriceUpsertConfig, StagingRow } from "./types.js";
import { loadIgnoredKeys, upsertMarketplaceGroups, upsertPriceData } from "./upsert.js";

const UPSERT_CONFIG: PriceUpsertConfig = {
  marketplace: "cardnexus",
};

const CN_FEEDS_URL = "https://public-api.cardnexus.com/v1/feeds/riftbound";
const FEED_TIMEOUT_MS = 30_000;

const FINISHES: Record<string, string> = {
  Standard: WellKnown.finish.NORMAL,
  Foil: WellKnown.finish.FOIL,
};

const LANGUAGES: Record<string, string> = {
  en: "EN",
  fr: "FR",
  ko: "KR",
  "zh-cn": "SC",
  "zh-tw": "TC",
};

interface CnFeedMeta {
  url: string;
  generatedAt: string;
}

interface CnFeeds {
  catalog: CnFeedMeta | null;
  expansions: CnFeedMeta | null;
  prices: CnFeedMeta | null;
}

interface CnExpansion {
  id: number;
  name: string;
  code: string | null;
}

interface CnExternalId {
  finish: string;
  id: number;
}

interface CnProduct {
  id: number;
  productType: string;
  name: string;
  expansionId: number | null;
  externalIds: { cardmarket?: CnExternalId[]; tcgplayer?: CnExternalId[] } | null;
}

interface CnListingBucket {
  low: number | null;
}

interface CnRegion {
  byCondition?: Record<string, { byLanguage?: Record<string, CnListingBucket> }>;
}

interface CnPriceRecord {
  productId: number;
  pricesByFinish: Record<string, { cardnexus?: { regions?: Record<string, CnRegion> } }>;
}

interface CnPrice {
  productId: number;
  finish: string;
  language: string;
  lowCents: number;
}

interface CardnexusFetchResult {
  expansions: CnExpansion[];
  cards: CnProduct[];
  prices: CnPrice[];
  recordedAt: Date;
}

async function fetchFeed<T>(fetchFn: Fetch, feed: CnFeedMeta): Promise<T[]> {
  const res = await fetchFn(feed.url, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} for CardNexus feed: ${await res.text()}`);
  }
  const text = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text();
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as T);
}

function extractPrices(records: CnPriceRecord[]): CnPrice[] {
  const prices: CnPrice[] = [];
  for (const record of records) {
    for (const [cnFinish, blocks] of Object.entries(record.pricesByFinish)) {
      const finish = FINISHES[cnFinish];
      const byLanguage = blocks.cardnexus?.regions?.eu?.byCondition?.NM?.byLanguage;
      if (!finish || !byLanguage) {
        continue;
      }
      for (const [cnLanguage, bucket] of Object.entries(byLanguage)) {
        const language = LANGUAGES[cnLanguage];
        const lowCents = bucket.low === null ? 0 : Math.round(bucket.low * 100);
        if (!language || lowCents <= 0) {
          continue;
        }
        prices.push({ productId: record.productId, finish, language, lowCents });
      }
    }
  }
  return prices;
}

async function fetchCardnexusData(
  fetchFn: Fetch,
  apiKey: string,
  log: Logger,
): Promise<CardnexusFetchResult> {
  const { data: feeds } = await fetchJson<CnFeeds>(fetchFn, CN_FEEDS_URL, {
    Authorization: `Bearer ${apiKey}`,
  });
  if (!feeds.catalog || !feeds.expansions || !feeds.prices) {
    throw new Error("CardNexus has not generated every Riftbound feed yet");
  }

  const [expansions, products, priceRecords] = await Promise.all([
    fetchFeed<CnExpansion>(fetchFn, feeds.expansions),
    fetchFeed<CnProduct>(fetchFn, feeds.catalog),
    fetchFeed<CnPriceRecord>(fetchFn, feeds.prices),
  ]);
  const cards = products.filter((p) => p.productType === "card" && p.expansionId !== null);
  const prices = extractPrices(priceRecords);
  log.info(`${expansions.length} expansions, ${cards.length} cards, ${prices.length} prices`);

  return {
    expansions,
    cards,
    prices,
    recordedAt: new Date(feeds.prices.generatedAt.slice(0, 10)),
  };
}

function buildCardnexusStaging(
  { cards, prices, recordedAt }: CardnexusFetchResult,
  ignoredKeys: LoadedIgnoredKeys,
): StagingRow[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const staging: StagingRow[] = [];
  for (const price of prices) {
    const card = cardsById.get(price.productId);
    if (!card || card.expansionId === null || ignoredKeys.productIds.has(card.id)) {
      continue;
    }
    if (ignoredKeys.variantKeys.has(`${card.id}::${price.finish}::${price.language}`)) {
      continue;
    }
    staging.push({
      externalId: card.id,
      groupId: card.expansionId,
      productName: card.name,
      finish: price.finish,
      language: price.language,
      recordedAt,
      marketCents: null,
      lowCents: price.lowCents,
      zeroLowCents: null,
      midCents: null,
      highCents: null,
      trendCents: null,
      avg1Cents: null,
      avg7Cents: null,
      avg30Cents: null,
    });
  }
  return staging;
}

function crossRefCandidates({ cards, prices }: CardnexusFetchResult): CrossRefCandidate[] {
  const observedByProduct = Map.groupBy(prices, (price) => price.productId);
  const candidates: CrossRefCandidate[] = [];
  for (const card of cards) {
    const observed = observedByProduct.get(card.id) ?? [];
    if (card.expansionId === null || observed.length === 0) {
      continue;
    }
    for (const [cnFinish, finish] of Object.entries(FINISHES)) {
      const idsFor = (ids: CnExternalId[] = []) =>
        ids.filter((entry) => entry.finish === cnFinish).map((entry) => entry.id);
      candidates.push({
        externalId: card.id,
        groupId: card.expansionId,
        productName: card.name,
        tcgplayerIds: idsFor(card.externalIds?.tcgplayer),
        cardmarketIds: idsFor(card.externalIds?.cardmarket),
        observed: observed.filter((price) => price.finish === finish),
      });
    }
  }
  return candidates;
}

function buildCardnexusGroups(expansions: CnExpansion[]): GroupRow[] {
  return expansions.map((e) => ({
    groupId: e.id,
    name: e.name,
    abbreviation: e.code ?? undefined,
  }));
}

export async function refreshCardnexusPrices(
  fetchFn: Fetch,
  repos: Repos,
  log: Logger,
  apiKey: string,
): Promise<PriceRefreshResponse> {
  const ignoredKeys = await loadIgnoredKeys(repos.priceRefresh, "cardnexus");
  const fetchResult = await fetchCardnexusData(fetchFn, apiKey, log);

  // Groups must exist before auto-match inserts products that reference them.
  const groupRows = buildCardnexusGroups(fetchResult.expansions);
  await upsertMarketplaceGroups(repos.priceRefresh, "cardnexus", groupRows);

  await autoMatchByCrossReference(repos, "cardnexus", crossRefCandidates(fetchResult), log);

  const staging = buildCardnexusStaging(fetchResult, ignoredKeys);
  const transformedCounts = {
    groups: groupRows.length,
    products: fetchResult.cards.length,
    prices: staging.length,
  };
  logFetchSummary(
    log,
    transformedCounts,
    ignoredKeys.productIds.size + ignoredKeys.variantKeys.size,
  );

  const counts = await upsertPriceData(repos.priceRefresh, log, UPSERT_CONFIG, staging);
  logUpsertCounts(log, counts);

  await repos.marketplace.refreshLatestPrices();

  return { transformed: transformedCounts, upserted: counts };
}
