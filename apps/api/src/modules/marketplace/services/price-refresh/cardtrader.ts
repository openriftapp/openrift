import type { Logger } from "@openrift/shared/logger";
import type { PriceRefreshResponse } from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";

import type { Repos } from "../../../../deps.js";
import type { Fetch } from "../../../../io.js";
import type { LoadedIgnoredKeys } from "../../repositories/price-refresh.js";
import type { CrossRefCandidate } from "./cross-ref-match.js";
import { autoMatchByCrossReference } from "./cross-ref-match.js";
import { logFetchSummary, logUpsertCounts } from "./log.js";
import type { GroupRow, PriceUpsertConfig, StagingRow } from "./types.js";
import { loadIgnoredKeys, upsertMarketplaceGroups, upsertPriceData } from "./upsert.js";

const UPSERT_CONFIG: PriceUpsertConfig = {
  marketplace: "cardtrader",
};

const CT_API_BASE = "https://api.cardtrader.com/api/v2";
const CT_GAME_ID = 22; // Riftbound
const CT_SINGLES_CATEGORY = 258;
const FETCH_TIMEOUT_MS = 30_000;

interface CtExpansion {
  id: number;
  game_id: number;
  code: string;
  name: string;
}

interface CtBlueprint {
  id: number;
  name: string;
  category_id: number;
  expansion_id: number;
  card_market_ids: number[];
  tcg_player_id: number | null;
}

interface CtMarketplaceProduct {
  blueprint_id: number;
  name_en: string;
  price_cents: number;
  price_currency: string;
  /** Number of copies sold together at price_cents; >1 means it's a bundle, not a single. */
  bundle_size?: number;
  /** Seller has paused the shop; listing is visible but not purchasable. */
  on_vacation?: boolean;
  user?: {
    /** Seller participates in CardTrader Zero (hub-eligible listings). */
    can_sell_via_hub?: boolean;
  };
  properties_hash?: {
    /** CardTrader condition string, e.g. "Near Mint", "Lightly Played". */
    condition?: string;
    riftbound_foil?: boolean;
    riftbound_language?: string;
  };
}

interface CtPrice {
  blueprintId: number;
  name: string;
  finish: string;
  language: string;
  /** Lowest asking price across all eligible sellers. */
  minPriceCents: number;
  /** Lowest asking price among CardTrader Zero (hub-eligible) sellers, if any. */
  minZeroPriceCents: number | null;
}

/**
 * Normalize CardTrader's language codes to the form stored on
 * `printings.language`. CardTrader uses `zh-CN` for Simplified Chinese; our
 * printings use Riot's printed code, `SC`. Everything else is upper-cased.
 *
 * `marketplace_products.language` has no FK to `languages`, so an un-normalized
 * code inserts cleanly and then joins to nothing — the prices just disappear
 * from the UI while the refresh reports success. Keep this in step with the
 * `languages` table.
 */
function normalizeCtLanguage(raw: string | undefined): string {
  if (!raw) {
    return WellKnown.language.EN;
  }
  const upper = raw.toUpperCase();
  if (upper === "ZH-CN" || upper === "ZH_CN") {
    return WellKnown.language.SC;
  }
  return upper;
}

/**
 * Fetch JSON from CardTrader API v2 with auth and timeout, unwrapping the
 * `{"array": [...]}` response wrapping some endpoints use.
 */
async function ctFetch<T>(
  fetchFn: Fetch,
  url: string,
  authHeaders: Record<string, string>,
): Promise<T> {
  const res = await fetchFn(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { ...authHeaders, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}: ${await res.text()}`);
  }
  const json: unknown = await res.json();
  if (
    json !== null &&
    typeof json === "object" &&
    "array" in json &&
    Array.isArray((json as Record<string, unknown>).array)
  ) {
    return (json as Record<string, unknown>).array as T;
  }
  return json as T;
}

interface CardtraderFetchResult {
  expansions: CtExpansion[];
  blueprints: CtBlueprint[];
  prices: Map<string, CtPrice>;
  recordedAt: Date;
}

async function fetchCardtraderData(
  fetchFn: Fetch,
  authHeaders: Record<string, string>,
  log: Logger,
): Promise<CardtraderFetchResult> {
  const allExpansions = await ctFetch<CtExpansion[]>(
    fetchFn,
    `${CT_API_BASE}/expansions`,
    authHeaders,
  );
  const expansions = allExpansions.filter((e) => e.game_id === CT_GAME_ID);
  log.info(`${expansions.length} Riftbound expansions`);

  const allBlueprints: CtBlueprint[] = [];
  for (const exp of expansions) {
    const blueprints = await ctFetch<CtBlueprint[]>(
      fetchFn,
      `${CT_API_BASE}/blueprints/export?expansion_id=${exp.id}`,
      authHeaders,
    );
    allBlueprints.push(...blueprints);
  }
  log.info(`${allBlueprints.length} blueprints total`);

  const prices = new Map<string, CtPrice>();
  for (const exp of expansions) {
    const products = await ctFetch<Record<string, CtMarketplaceProduct[]>>(
      fetchFn,
      `${CT_API_BASE}/marketplace/products?expansion_id=${exp.id}`,
      authHeaders,
    );

    for (const [bpId, allListings] of Object.entries(products)) {
      if (allListings.length === 0) {
        continue;
      }
      const id = Number(bpId);

      const eligible = allListings.filter(
        (listing) =>
          (!listing.properties_hash?.condition ||
            listing.properties_hash.condition === "Near Mint") &&
          listing.on_vacation !== true &&
          (listing.bundle_size ?? 1) === 1,
      );
      if (eligible.length === 0) {
        continue;
      }

      const byLangFinish = new Map<string, CtMarketplaceProduct[]>();
      for (const listing of eligible) {
        const lang = normalizeCtLanguage(listing.properties_hash?.riftbound_language);
        const finish =
          listing.properties_hash?.riftbound_foil === true
            ? WellKnown.finish.FOIL
            : WellKnown.finish.NORMAL;
        const key = `${lang}::${finish}`;
        const list = byLangFinish.get(key) ?? [];
        list.push(listing);
        byLangFinish.set(key, list);
      }

      for (const [key, listings] of byLangFinish) {
        const [language, finish] = key.split("::") as [string, string];
        const cheapest = listings.reduce((min, p) => (p.price_cents < min.price_cents ? p : min));
        const zeroListings = listings.filter((listing) => listing.user?.can_sell_via_hub === true);
        const cheapestZero =
          zeroListings.length > 0
            ? zeroListings.reduce((min, p) => (p.price_cents < min.price_cents ? p : min))
            : null;
        prices.set(`${id}::${finish}::${language}`, {
          blueprintId: id,
          name: cheapest.name_en,
          finish,
          language,
          minPriceCents: cheapest.price_cents,
          minZeroPriceCents: cheapestZero?.price_cents ?? null,
        });
      }
    }
  }
  log.info(`${prices.size} blueprint+finish prices`);

  return {
    expansions,
    blueprints: allBlueprints,
    prices,
    recordedAt: new Date(new Date().toISOString().slice(0, 10)),
  };
}

function buildCardtraderStaging(
  { blueprints, prices, recordedAt }: CardtraderFetchResult,
  ignoredKeys: LoadedIgnoredKeys,
): StagingRow[] {
  const allStaging: StagingRow[] = [];

  for (const bp of blueprints) {
    if (bp.category_id !== CT_SINGLES_CATEGORY) {
      continue;
    }
    if (ignoredKeys.productIds.has(bp.id)) {
      continue;
    }
    for (const price of prices.values()) {
      if (price.blueprintId !== bp.id || price.minPriceCents <= 0) {
        continue;
      }
      if (ignoredKeys.variantKeys.has(`${bp.id}::${price.finish}::${price.language}`)) {
        continue;
      }
      allStaging.push({
        externalId: bp.id,
        groupId: bp.expansion_id,
        productName: bp.name,
        finish: price.finish,
        language: price.language,
        recordedAt,
        marketCents: null,
        lowCents: price.minPriceCents,
        zeroLowCents: price.minZeroPriceCents,
        midCents: null,
        highCents: null,
        trendCents: null,
        avg1Cents: null,
        avg7Cents: null,
        avg30Cents: null,
      });
    }
  }

  return allStaging;
}

function buildCardtraderGroups(expansions: CtExpansion[]): GroupRow[] {
  return expansions.map((e) => ({
    groupId: e.id,
    name: e.name,
    abbreviation: e.code,
  }));
}

function crossRefCandidates(
  blueprints: CtBlueprint[],
  prices: Map<string, CtPrice>,
): CrossRefCandidate[] {
  const pricesByBlueprint = Map.groupBy([...prices.values()], (p) => p.blueprintId);
  return blueprints
    .filter((bp) => bp.category_id === CT_SINGLES_CATEGORY)
    .map((bp) => ({
      externalId: bp.id,
      groupId: bp.expansion_id,
      productName: bp.name,
      tcgplayerIds: bp.tcg_player_id === null ? [] : [bp.tcg_player_id],
      cardmarketIds: bp.card_market_ids,
      observed: pricesByBlueprint.get(bp.id) ?? [],
    }));
}

export async function refreshCardtraderPrices(
  fetchFn: Fetch,
  repos: Repos,
  log: Logger,
  apiToken: string,
): Promise<PriceRefreshResponse> {
  const authHeaders = { Authorization: `Bearer ${apiToken}` };
  const ignoredKeys = await loadIgnoredKeys(repos.priceRefresh, "cardtrader");

  const fetchResult = await fetchCardtraderData(fetchFn, authHeaders, log);
  const { expansions, blueprints, prices } = fetchResult;

  // Groups must be upserted before auto-match: the variant rows need the FK.
  const groupRows = buildCardtraderGroups(expansions);
  await upsertMarketplaceGroups(repos.priceRefresh, "cardtrader", groupRows);

  // Auto-match before transform so newly matched products get snapshots.
  await autoMatchByCrossReference(repos, "cardtrader", crossRefCandidates(blueprints, prices), log);

  const allStaging = buildCardtraderStaging(fetchResult, ignoredKeys);

  const transformedCounts = {
    groups: groupRows.length,
    products: blueprints.filter((bp) => bp.category_id === CT_SINGLES_CATEGORY).length,
    prices: allStaging.length,
  };

  logFetchSummary(
    log,
    transformedCounts,
    ignoredKeys.productIds.size + ignoredKeys.variantKeys.size,
  );

  const counts = await upsertPriceData(repos.priceRefresh, log, UPSERT_CONFIG, allStaging);
  logUpsertCounts(log, counts);

  await repos.marketplace.refreshLatestPrices();

  return { transformed: transformedCounts, upserted: counts };
}
