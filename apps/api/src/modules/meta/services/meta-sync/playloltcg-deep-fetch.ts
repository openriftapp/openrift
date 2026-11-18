import { clamp } from "@openrift/shared/math";
import { errorMessage } from "@openrift/shared/strings";
import type { Insertable } from "kysely";

import type { PlayloltcgEventStandingsTable } from "../../../../db/tables/meta-sources.js";
import { coord, record } from "../../../../lib/json-coerce.js";
import { META_PLAYER_NAME_MAX } from "../../../../lib/meta-name-limits.js";
import { PLAYLOLTCG_PROVIDER } from "../../../../lib/meta-providers.js";
import { legendFromDeckLines } from "../../lib/meta-deck-lines.js";
import type { PlayloltcgDeckLine } from "../../lib/playloltcg-catalog.js";
import {
  normalizeCardNo,
  projectPlayloltcgDeckLines,
  referencedDeckIds,
} from "../../lib/playloltcg-catalog.js";
import type { PlayloltcgListRow } from "../../repositories/playloltcg-events.js";
import { promoteMetaEvent } from "../meta-promote.js";
import { clock } from "./deps.js";
import { PlayloltcgRefusedError } from "./playloltcg-client.js";
import type { PlayloltcgSyncDeps } from "./playloltcg-deps.js";
import { isPermanentRefusal, RunDeadlineError, sourceStopOf } from "./source-http.js";

// The source refuses a larger page with `code 500 网络繁忙` (network busy).
const STANDINGS_PAGE_SIZE = 20;

const MAX_STANDINGS_PAGES = 500;

export interface PlayloltcgDeepFetchResult {
  activityShopId: number;
  requests: number;
  players: number;
  decks: number;
  deckRequests: number;
  decksRemaining: number;
  acceptedPlayers: number;
  skippedPlayers: number;
  shopId: number | null;
  publishedResults: boolean;
  complete: boolean;
  errors: string[];
}

export interface PlayloltcgDetailFacts {
  shopId: number | null;
  shopName: string | null;
  isPublishResult: boolean;
}

function rethrowIfBlocked(error: unknown): void {
  if (sourceStopOf(error) !== null || error instanceof RunDeadlineError) {
    throw error;
  }
}

/** Returns null only on a failed read, never to mean "not published yet" (that would reset a finished event's ladder). */
export async function readPlayloltcgDetail(
  deps: PlayloltcgSyncDeps,
  activityShopId: number,
  errors: string[],
  options: { rethrowRefusal?: boolean } = {},
): Promise<PlayloltcgDetailFacts | null> {
  try {
    const result = await deps.client.get<unknown>("/xcx/activityShop/info", {
      activityShopId,
      type: 1,
    });
    const row = record(result);
    const shop = record(row?.shopInfoResponse);
    const shopId = typeof shop?.id === "number" && Number.isInteger(shop.id) ? shop.id : null;
    const shopName = typeof shop?.name === "string" ? shop.name : null;
    return { shopId, shopName, isPublishResult: row?.isPublishResult === true };
  } catch (error) {
    rethrowIfBlocked(error);
    if (options.rethrowRefusal === true && isPermanentRefusal(error)) {
      throw error;
    }
    errors.push(`Event ${activityShopId} detail: ${errorMessage(error)}`);
    return null;
  }
}

/**
 * No row total, so a short page is the end. A page starting below the last rank means `pageNum`
 * is ignored; ties may straddle a page.
 */
async function readStandings(
  deps: PlayloltcgSyncDeps,
  activityShopId: number,
  errors: string[],
): Promise<Record<string, unknown>[] | null> {
  const rows: Record<string, unknown>[] = [];
  let lastRank = 0;
  for (let pageNum = 1; pageNum <= MAX_STANDINGS_PAGES; pageNum++) {
    let body;
    try {
      body = await deps.client.postList<Record<string, unknown>>(
        "/xcx/activityUser/pageForActivityDetail",
        { pageNum, pageSize: STANDINGS_PAGE_SIZE, activityShopId },
      );
    } catch (error) {
      rethrowIfBlocked(error);
      errors.push(
        `Event ${activityShopId} standings after rank ${lastRank}: ${errorMessage(error)}`,
      );
      return null;
    }
    const first = coord(body.items[0]?.finalRanking);
    if (pageNum > 1 && body.items.length > 0 && (first === null || first < lastRank)) {
      errors.push(`Event ${activityShopId} standings stopped advancing at rank ${lastRank}.`);
      return null;
    }
    rows.push(...body.items);
    if (body.items.length < STANDINGS_PAGE_SIZE) {
      return rows;
    }
    const last = coord(body.items.at(-1)?.finalRanking);
    if (last === null) {
      errors.push(`Event ${activityShopId} standings stopped advancing at rank ${lastRank}.`);
      return null;
    }
    lastRank = last;
  }
  errors.push(`Event ${activityShopId} standings exceeded ${MAX_STANDINGS_PAGES} pages.`);
  return null;
}

const SKIPPED = Symbol("deck skipped");

const REFUSED = Symbol("deck refused");

const OUT_OF_TIME = Symbol("out of time");

/** Any failure other than a refusal records nothing and retries next pass. */
async function readDeck(
  deps: PlayloltcgSyncDeps,
  cardGroupId: string,
  errors: string[],
): Promise<Record<string, unknown>[] | typeof REFUSED | typeof SKIPPED | typeof OUT_OF_TIME> {
  try {
    const body = await deps.client.postList<Record<string, unknown>>(
      "/xcx/cardGroup/getActivityCardGroupCardListImage",
      { id: Number(cardGroupId) },
    );
    return body.items;
  } catch (error) {
    if (error instanceof RunDeadlineError) {
      return OUT_OF_TIME;
    }
    rethrowIfBlocked(error);
    errors.push(`Deck ${cardGroupId}: ${errorMessage(error)}`);
    return error instanceof PlayloltcgRefusedError ? REFUSED : SKIPPED;
  }
}

interface PlayloltcgDeckReads {
  bodies: Map<string, Record<string, unknown>[]>;
  refused: string[];
  empty: string[];
  requests: number;
  outOfTime: boolean;
}

function noDeckReads(): PlayloltcgDeckReads {
  return { bodies: new Map(), refused: [], empty: [], requests: 0, outOfTime: false };
}

async function readDecks(
  deps: PlayloltcgSyncDeps,
  ids: readonly string[],
  reads: PlayloltcgDeckReads,
  errors: string[],
): Promise<void> {
  for (const id of ids) {
    const body = await readDeck(deps, id, errors);
    if (body === OUT_OF_TIME) {
      reads.outOfTime = true;
      return;
    }
    reads.requests++;
    if (body === REFUSED) {
      reads.refused.push(id);
    } else if (body !== SKIPPED && body.length === 0) {
      reads.empty.push(id);
    } else if (body !== SKIPPED) {
      reads.bodies.set(id, body);
    }
  }
}

const EMPTY_RETRIES_PER_VISIT = 5;

/** Marked before the read, so a visit cut after the ask still counts as one. */
async function readEmptyDecks(
  deps: PlayloltcgSyncDeps,
  activityShopId: number,
  sourceDeckIds: readonly string[],
  budget: number,
  reads: PlayloltcgDeckReads,
  errors: string[],
): Promise<void> {
  const asked = sourceDeckIds.slice(0, clamp(budget, 0, EMPTY_RETRIES_PER_VISIT));
  await deps.repos.playloltcgResults.markDecksAsked(activityShopId, asked, clock(deps));
  await readDecks(deps, asked, reads, errors);
}

interface PlayloltcgDeckFetch extends PlayloltcgDeckReads {
  remaining: number;
}

/**
 * Missing decks are diffed against the standings just read, not the mirror's prior fetch, which holds nothing on a first visit.
 * `retry` is read only once no missing deck is left, so it never feeds a resume.
 */
async function fetchDecks(
  deps: PlayloltcgSyncDeps,
  activityShopId: number,
  standings: readonly Record<string, unknown>[],
  held: ReadonlySet<string>,
  retry: readonly string[],
  budget: number,
  errors: string[],
): Promise<PlayloltcgDeckFetch> {
  const missing = referencedDeckIds(standings).filter((id) => !held.has(id));
  const wanted = missing.slice(0, Math.max(budget, 0));
  if (wanted.length < missing.length) {
    errors.push(
      `Event ${activityShopId} is missing ${missing.length} decks; read ${wanted.length} within this run's budget, the rest follow shortly.`,
    );
  }
  const reads = noDeckReads();
  await readDecks(deps, wanted, reads, errors);
  const remaining = missing.length - reads.requests;
  if (!reads.outOfTime && remaining === 0) {
    await readEmptyDecks(deps, activityShopId, retry, budget - reads.requests, reads, errors);
  }
  if (reads.outOfTime) {
    errors.push(
      `Event ${activityShopId}: stopped reading decks at the run's time budget; the rest follow shortly.`,
    );
  }
  return { ...reads, remaining };
}

async function storeDeckReads(
  deps: PlayloltcgSyncDeps,
  activityShopId: number,
  reads: PlayloltcgDeckReads,
  errors: string[],
): Promise<Map<string, PlayloltcgDeckLine[]>> {
  const shortCodes = [...reads.bodies.values()]
    .flat()
    .map((card) => normalizeCardNo((record(card) ?? {}).cardNo))
    .filter((code): code is string => code !== null);
  const bridge = await deps.repos.playloltcgEvents.cardsByShortCode(shortCodes);

  const freshLines = new Map<string, PlayloltcgDeckLine[]>();
  for (const [sourceDeckId, body] of reads.bodies) {
    const lines = projectPlayloltcgDeckLines(body, bridge);
    if (lines.length === 0) {
      errors.push(`Deck ${sourceDeckId}: none of its ${body.length} cards could be read.`);
    }
    freshLines.set(sourceDeckId, lines);
    await deps.repos.playloltcgResults.putDecklist(
      { sourceDeckId, activityShopId, fetchStatus: "fetched", fetchedAt: clock(deps) },
      lines,
    );
  }
  for (const sourceDeckId of reads.refused) {
    await deps.repos.playloltcgResults.putDecklist(
      { sourceDeckId, activityShopId, fetchStatus: "refused", fetchedAt: clock(deps) },
      [],
    );
  }
  // A `fetched` row without cards stays retryable until the recheck makes it final; its
  // `fetchedAt` is the last ask, which spaces the retries.
  for (const sourceDeckId of reads.empty) {
    await deps.repos.playloltcgResults.putDecklist(
      { sourceDeckId, activityShopId, fetchStatus: "fetched", fetchedAt: clock(deps) },
      [],
    );
  }
  return freshLines;
}

/** True when a deck gained card rows, which reach the standings only through a deep fetch. */
export async function retryEmptyPlayloltcgDecks(
  deps: PlayloltcgSyncDeps,
  activityShopId: number,
  sourceDeckIds: readonly string[],
  budget: number,
  errors: string[],
): Promise<boolean> {
  const reads = noDeckReads();
  await readEmptyDecks(deps, activityShopId, sourceDeckIds, budget, reads, errors);
  const lines = await storeDeckReads(deps, activityShopId, reads, errors);
  return [...lines.values()].some((deck) => deck.length > 0);
}

/**
 * Keyed by source user id, or name+occurrence as fallback, never rank:
 * the source re-ranks standings on finalization.
 */
function playerKey(
  row: Record<string, unknown>,
  playerName: string,
  seenNames: Map<string, number>,
): string {
  const userId = coord(row.userId);
  if (userId !== null && Number.isInteger(userId) && userId > 0) {
    return `u${userId}`;
  }
  const occurrence = (seenNames.get(playerName) ?? 0) + 1;
  seenNames.set(playerName, occurrence);
  return `n${playerName}#${occurrence}`;
}

/** Failures are collected, not thrown; a bad deck body doesn't block the rest of the standings table. */
export async function playloltcgDeepFetch(
  deps: PlayloltcgSyncDeps,
  row: PlayloltcgListRow,
  detail: PlayloltcgDetailFacts,
  deckBudget: number,
  retryEmpty: readonly string[] = [],
): Promise<PlayloltcgDeepFetchResult> {
  const before = deps.client.requests;
  const errors: string[] = [];
  const activityShopId = row.activityShopId;
  const externalId = String(activityShopId);

  if (detail.shopId !== null) {
    await deps.repos.playloltcgEvents.linkShopFromDetail(activityShopId, {
      id: detail.shopId,
      name: detail.shopName ?? row.shopName ?? String(detail.shopId),
    });
  }

  const held = await deps.repos.playloltcgResults.heldDeckIds(activityShopId);
  const standings = await readStandings(deps, activityShopId, errors);
  if (standings === null) {
    return {
      activityShopId,
      requests: deps.client.requests - before,
      players: 0,
      decks: 0,
      deckRequests: 0,
      decksRemaining: 0,
      acceptedPlayers: 0,
      skippedPlayers: 0,
      shopId: detail.shopId,
      publishedResults: detail.isPublishResult,
      complete: false,
      errors,
    };
  }

  const fetched = await fetchDecks(
    deps,
    activityShopId,
    standings,
    held,
    retryEmpty,
    deckBudget,
    errors,
  );
  const heldLines = await deps.repos.playloltcgResults.decklistCards(activityShopId);
  const freshLines = await storeDeckReads(deps, activityShopId, fetched, errors);

  const seenNames = new Map<string, number>();
  const rows: Insertable<PlayloltcgEventStandingsTable>[] = [];
  for (const s of standings) {
    const rank = coord(s.finalRanking);
    const rawName = typeof s.name === "string" ? s.name.trim() : "";
    if (rank === null || rank < 1 || rawName === "") {
      continue;
    }
    const playerName = rawName.slice(0, META_PLAYER_NAME_MAX);
    const cardGroupId = coord(s.cardGroupId) ?? 0;
    const sourceDeckId = cardGroupId > 0 ? String(cardGroupId) : null;
    const lines: readonly { zone: string; cardName: string }[] =
      sourceDeckId === null
        ? []
        : (freshLines.get(sourceDeckId) ?? heldLines.get(sourceDeckId) ?? []);
    const userId = coord(s.userId);
    rows.push({
      activityShopId,
      playerKey: playerKey(s, playerName, seenNames),
      sourceUserId: userId !== null && Number.isInteger(userId) && userId > 0 ? userId : null,
      playerName,
      rank,
      wins: coord(s.winCount),
      losses: null,
      draws: null,
      legendName: legendFromDeckLines(lines),
      sourceDeckId,
      fetchedAt: clock(deps),
    });
  }

  await deps.repos.playloltcgResults.replaceStandings(activityShopId, rows);

  const source = await deps.repos.meta.sourceByKey(PLAYLOLTCG_PROVIDER, externalId);

  const result: PlayloltcgDeepFetchResult = {
    activityShopId,
    requests: deps.client.requests - before,
    players: rows.length,
    decks: fetched.bodies.size,
    deckRequests: fetched.requests,
    decksRemaining: fetched.remaining,
    acceptedPlayers: 0,
    skippedPlayers: 0,
    shopId: detail.shopId,
    publishedResults: detail.isPublishResult,
    complete: true,
    errors,
  };

  if (source !== undefined) {
    const promoted = await promoteMetaEvent(deps.repos, source.metaEventId);
    result.acceptedPlayers = promoted.players;
    result.skippedPlayers = promoted.unresolvedNames.length;
    errors.push(...promoted.errors);
  }

  return result;
}
