import { metaContract } from "@openrift/shared/contracts/meta";
import { STANDINGS_PAGE_SIZE } from "@openrift/shared/meta-query";
import { cutPhaseOrders, cutSizeOf } from "@openrift/shared/meta-standings";
import type {
  MetaDeckCardIndexResponse,
  MetaDeckDetailResponse,
  MetaDeckFacetsResponse,
  MetaDeckListResponse,
  MetaActivityResponse,
  MetaEventDayCountsResponse,
  MetaEventFacetsResponse,
  MetaEventDetailResponse,
  MetaEventRunResponse,
  MetaEventStandingsResponse,
  MetaEventListResponse,
  MetaCountsResponse,
  MetaListShape,
  MetaLegendDetailResponse,
  MetaLegendListResponse,
  MetaPendingSubmissionsResponse,
  MetaPlayerDetailResponse,
} from "@openrift/shared/types/api/meta";
import { implement } from "@orpc/server";

import type { Repos } from "../../../deps.js";
import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { buildPublicDeckDetailWithExtras } from "../../decks/lib/public-deck-payload.js";
import {
  guessedCardRows,
  toMetaDeckInference,
  toMetaListShape,
} from "../lib/meta-inference-presenters.js";
import {
  archiveLegendSlug,
  toMetaDeckCardIndex,
  toMetaDeckContext,
  toMetaDeckFacets,
  toMetaDeckSummary,
  toMetaEventDetail,
  toMetaEventField,
  toMetaEventMatch,
  toMetaEventPhase,
  toMetaEventPlayer,
  toMetaEventSummary,
  toMetaRunRound,
  toMetaStandingsRow,
  toStandingsRounds,
  toMetaActivityItem,
  toMetaEventFinish,
  toMetaLegendFinish,
  toMetaLegendRef,
  toMetaLegendSummary,
  toMetaPendingSubmission,
  toMetaPlayerFinish,
} from "../lib/meta-presenters.js";
import type { MetaEventPlayerRow } from "../repositories/meta-players.js";

const os = implement(metaContract).$context<ApiContext>().use(requireUser);

const ACTIVITY_LIMIT = 6;

const EVENT_PAGE_SIZE = 50;

const BEST_FINISH_COUNT = 5;

const FINISH_PAGE_SIZE = 25;

/**
 * Resolves each card's canonical image in one batch (`preferredPrintingId: null`
 * asks for the card's default, not a particular printing).
 */
async function imageIdsForCards(
  canonicalPrintings: Repos["canonicalPrintings"],
  cardIds: string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(cardIds)];
  if (unique.length === 0) {
    return new Map();
  }
  const metas = await canonicalPrintings.resolvePrintingMetaForRows(
    unique.map((cardId) => ({ cardId, preferredPrintingId: null })),
  );
  return new Map(unique.map((cardId, index) => [cardId, metas[index]?.imageId ?? null]));
}

async function listShapesFor(
  repos: Repos,
  rows: readonly { deckId: string | null; listStatus: string }[],
): Promise<Map<string, MetaListShape>> {
  const deckIds = rows.flatMap((row) =>
    row.deckId !== null && row.listStatus === "partial" ? [row.deckId] : [],
  );
  const shapes = await repos.metaInferences.listShapes(deckIds);
  return new Map(shapes.map((shape) => [shape.deckId, toMetaListShape(shape)]));
}

function referencedCardIds(
  rows: readonly { legendCardId: string | null; championCardId: string | null }[],
): string[] {
  return rows.flatMap((row) =>
    [row.legendCardId, row.championCardId].filter((id): id is string => id !== null),
  );
}

/** Public meta archive, mounted under `/api/v1/meta`. Every route is anonymous and SSR-facing. */
export const metaRouter = {
  events: os.events.handler(async ({ input, context }): Promise<MetaEventListResponse> => {
    const { meta, canonicalPrintings } = context.repos;
    const { by, dir, limit, offset, ...filters } = input;

    const { rows, total } = await meta.eventIndex(
      filters,
      { by, dir },
      { limit: limit ?? EVENT_PAGE_SIZE, offset: offset ?? 0 },
    );
    const finishes = await meta.topFinishesForEvents(rows.map((row) => row.id));
    const images = await imageIdsForCards(
      canonicalPrintings,
      finishes.map((finish) => finish.legendCardId).filter((id) => id !== null),
    );
    const byEvent = Map.groupBy(finishes, (finish) => finish.metaEventId);

    return {
      events: rows.map((row) =>
        toMetaEventSummary(
          row,
          (byEvent.get(row.id) ?? []).map((finish) => toMetaEventFinish(finish, images)),
        ),
      ),
      total,
    };
  }),

  eventFacets: os.eventFacets.handler(
    async ({ input, context }): Promise<MetaEventFacetsResponse> => {
      const { meta } = context.repos;
      const [facets, holdings, totals] = await Promise.all([
        meta.eventFacetCounts(input),
        meta.eventHoldingsCounts(input),
        meta.eventTotals(input),
      ]);
      return { ...facets, holdings, totals };
    },
  ),

  eventDayCounts: os.eventDayCounts.handler(
    async ({ input, context }): Promise<MetaEventDayCountsResponse> => ({
      days: await context.repos.meta.eventDayCounts(input),
    }),
  ),

  activity: os.activity.handler(async ({ context }): Promise<MetaActivityResponse> => {
    const items = await context.repos.meta.recentActivity(ACTIVITY_LIMIT);
    return { items: items.map((row) => toMetaActivityItem(row)) };
  }),

  event: os.event.handler(async ({ input, context, errors }): Promise<MetaEventDetailResponse> => {
    const { meta, canonicalPrintings } = context.repos;

    const event = await meta.eventBySlug(input.slug);
    if (!event) {
      throw errors.NOT_FOUND({ message: "Event not found" });
    }

    const [standings, field, bestPerLegend, phases, sources, contributors] = await Promise.all([
      meta.standingsPage(event.id, {}, { limit: STANDINGS_PAGE_SIZE, offset: 0 }),
      meta.fieldSummaryForEvent(event.id),
      meta.bestPerLegendForEvent(event.id),
      meta.phasesForEvent(event.id),
      meta.sourcesForEvent(event.id),
      meta.contributorsForEvent(event.id),
    ]);
    const cutPhases = cutPhaseOrders(phases);
    const cutSize = cutSizeOf(phases);
    const shown = [...standings.rows, ...bestPerLegend];
    const [images, matches, cutMatches, cutLine, shapes] = await Promise.all([
      imageIdsForCards(canonicalPrintings, referencedCardIds(shown)),
      meta.matchesForPlayers(
        event.id,
        shown.map((row) => row.id),
      ),
      meta.matchesInPhases(event.id, [...cutPhases]),
      cutSize === null ? undefined : meta.cutLineRowForEvent(event.id, cutSize),
      listShapesFor(context.repos, shown),
    ]);
    const rounds = toStandingsRounds(matches, cutPhases);
    const row = (player: MetaEventPlayerRow) =>
      toMetaStandingsRow(player, images, rounds.get(player.id), shapes);
    const topFinishes = standings.rows
      .filter((player) => player.rank <= 3)
      .map((player) => toMetaEventFinish(player, images));

    return {
      event: toMetaEventDetail(event, { sources, contributors, topFinishes }),
      standings: { players: standings.rows.map((player) => row(player)), total: standings.total },
      field: toMetaEventField(field, cutLine),
      bestPerLegend: bestPerLegend.map((player) => row(player)),
      cutMatches: cutMatches.map((match) => toMetaEventMatch(match)),
      phases: phases.map((phase) => toMetaEventPhase(phase)),
    };
  }),

  standings: os.standings.handler(
    async ({ input, context, errors }): Promise<MetaEventStandingsResponse> => {
      const { meta, canonicalPrintings } = context.repos;

      const event = await meta.eventBySlug(input.slug);
      if (!event) {
        throw errors.NOT_FOUND({ message: "Event not found" });
      }

      const { rows, total } = await meta.standingsPage(
        event.id,
        { q: input.q, withList: input.list === "with", legend: input.legend },
        { limit: input.limit ?? STANDINGS_PAGE_SIZE, offset: input.offset ?? 0 },
      );
      const phases = await meta.phasesForEvent(event.id);
      const [images, matches, shapes] = await Promise.all([
        imageIdsForCards(canonicalPrintings, referencedCardIds(rows)),
        meta.matchesForPlayers(
          event.id,
          rows.map((player) => player.id),
        ),
        listShapesFor(context.repos, rows),
      ]);
      const rounds = toStandingsRounds(matches, cutPhaseOrders(phases));

      return {
        players: rows.map((player) =>
          toMetaStandingsRow(player, images, rounds.get(player.id), shapes),
        ),
        total,
      };
    },
  ),

  run: os.run.handler(async ({ input, context, errors }): Promise<MetaEventRunResponse> => {
    const { meta, canonicalPrintings } = context.repos;

    const event = await meta.eventBySlug(input.slug);
    if (!event) {
      throw errors.NOT_FOUND({ message: "Event not found" });
    }
    const player = await meta.standingsRowByKey(event.id, input.key);
    if (!player) {
      throw errors.NOT_FOUND({ message: "Player not found" });
    }

    const phases = await meta.phasesForEvent(event.id);
    const cutPhases = cutPhaseOrders(phases);
    const [matches, cutMatches] = await Promise.all([
      meta.matchesForPlayers(event.id, [player.id]),
      meta.matchesInPhases(event.id, [...cutPhases]),
    ]);
    const rounds = matches.map((match) => toMetaRunRound(match, player.id, cutPhases));
    const opponents = await meta.standingsRowsByIds([
      ...new Set(rounds.map((round) => round.opponentId).filter((id) => id !== null)),
    ]);
    const images = await imageIdsForCards(
      canonicalPrintings,
      referencedCardIds([player, ...opponents]),
    );
    // Round numbers restart with each phase, so the final is read from the last
    // cut phase alone.
    const lastCutPhase = cutMatches.at(-1)?.phaseOrder ?? null;
    const lastPhaseMatches = cutMatches.filter((match) => match.phaseOrder === lastCutPhase);
    const lastCutRound = lastPhaseMatches.at(-1)?.roundNumber ?? null;
    const finalRound = lastPhaseMatches.filter((match) => match.roundNumber === lastCutRound);

    return {
      event: toMetaEventSummary(event),
      phases: phases.map((phase) => toMetaEventPhase(phase)),
      player: toMetaStandingsRow(
        player,
        images,
        rounds.map((round) => ({
          phaseOrder: round.phaseOrder,
          roundNumber: round.roundNumber,
          isCut: round.isCut,
          outcome: round.outcome,
        })),
      ),
      rounds,
      opponents: opponents.map((opponent) => toMetaEventPlayer(opponent, images)),
      lastCutRound,
      finalRoundNumber: finalRound.length === 1 ? lastCutRound : null,
    };
  }),

  pendingSubmissions: os.pendingSubmissions.handler(
    async ({ input, context, errors }): Promise<MetaPendingSubmissionsResponse> => {
      const event = await context.repos.meta.eventBySlug(input.slug);
      if (!event) {
        throw errors.NOT_FOUND({ message: "Event not found" });
      }
      const [rows, viewer] = await Promise.all([
        context.repos.metaSubmissions.pendingForEvent(event.id),
        context.loadUser(),
      ]);
      return { items: rows.map((row) => toMetaPendingSubmission(row, viewer?.id ?? null)) };
    },
  ),

  decks: os.decks.handler(async ({ input, context }): Promise<MetaDeckListResponse> => {
    const { meta, metaInferences, canonicalPrintings } = context.repos;

    const { rows, total, eventCount, archiveTotal } = await meta.allDeckSummaries(input);
    const partialDeckIds = rows
      .filter((row) => row.listStatus === "partial")
      .map((row) => row.deckId);
    const [events, shapeRows] = await Promise.all([
      meta.eventsBySlugs([...new Set(rows.map((row) => row.eventSlug))]),
      metaInferences.listShapes(partialDeckIds),
    ]);
    const guessedChampionIds = shapeRows.flatMap((shape) =>
      shape.guessedChampionCardId === null ? [] : [shape.guessedChampionCardId],
    );
    const images = await imageIdsForCards(canonicalPrintings, [
      ...referencedCardIds(rows),
      ...guessedChampionIds,
    ]);
    const shapeByDeck = new Map(shapeRows.map((shape) => [shape.deckId, shape]));

    return {
      decks: rows.map((row) => toMetaDeckSummary(row, images, shapeByDeck.get(row.deckId))),
      events: events.map((event) => toMetaEventSummary(event)),
      total,
      eventCount,
      archiveTotal,
    };
  }),

  deckFacets: os.deckFacets.handler(async ({ input, context }): Promise<MetaDeckFacetsResponse> =>
    toMetaDeckFacets(await context.repos.meta.deckFacetCounts(input)),
  ),

  deckCards: os.deckCards.handler(
    async ({ input, context }): Promise<MetaDeckCardIndexResponse> => {
      const { meta } = context.repos;
      const { event, ...narrowing } = input;
      return toMetaDeckCardIndex(await meta.allDeckCards({ ...narrowing, eventSlug: event }));
    },
  ),

  deck: os.deck.handler(async ({ input, context, errors }): Promise<MetaDeckDetailResponse> => {
    const { decks, meta, metaInferences, catalog } = context.repos;

    const found = await decks.getByShareToken(input.token);
    if (!found) {
      throw errors.NOT_FOUND({ message: "Deck not found" });
    }

    const metaContext = await meta.contextForDeck(found.deck.id);
    if (!metaContext) {
      throw errors.NOT_FOUND({ message: "Deck not found" });
    }

    const inference =
      metaContext.listStatus === "partial"
        ? await metaInferences.inferenceForDeck(found.deck.id)
        : undefined;
    const [{ payload, extraCards }, contributors, alsoSeen] = await Promise.all([
      buildPublicDeckDetailWithExtras(
        context.repos,
        found,
        inference === undefined ? [] : guessedCardRows(inference),
      ),
      meta.contributorsForPlayer(metaContext.playerId),
      inference === undefined || inference.battlefieldAlsoCardIds.length === 0
        ? []
        : catalog.cardsByIds(inference.battlefieldAlsoCardIds),
    ]);
    return {
      ...payload,
      meta: toMetaDeckContext(metaContext, contributors),
      inferred:
        inference === undefined
          ? null
          : toMetaDeckInference(
              inference,
              payload.cards,
              extraCards,
              alsoSeen.map((card) => ({ cardId: card.id, name: card.name, slug: card.slug })),
              payload.deck.format,
            ),
    };
  }),

  legends: os.legends.handler(async ({ input, context }): Promise<MetaLegendListResponse> => {
    const { meta, canonicalPrintings } = context.repos;

    const [rows, total, archiveTotal, countries] = await Promise.all([
      meta.scopedLegendRecords(input),
      meta.scopedLegendCount(input),
      meta.scopedLegendCount({}),
      meta.scopedLegendCountries(input),
    ]);
    const [images, events] = await Promise.all([
      imageIdsForCards(
        canonicalPrintings,
        rows.map((row) => row.cardId),
      ),
      meta.eventRowsByIds(rows.map((row) => row.bestEventId)),
    ]);
    const eventById = new Map(events.map((event) => [event.id, event]));

    return {
      legends: rows
        .flatMap((row) => {
          const bestEvent = eventById.get(row.bestEventId);
          return bestEvent === undefined ? [] : [toMetaLegendSummary(row, images, bestEvent)];
        })
        // Sorted here: the repo groups by the stored epithet, which files Azir under E.
        .toSorted((a, b) => a.legend.name.localeCompare(b.legend.name)),
      total,
      archiveTotal,
      countries,
    };
  }),

  legend: os.legend.handler(
    async ({ input, context, errors }): Promise<MetaLegendDetailResponse> => {
      const { meta, canonicalPrintings } = context.repos;

      // The route key is composed from the card's champion tag and slug, so it
      // can't be looked up by a column; the archive holds only a few dozen legends.
      const legends = await meta.archiveLegends();
      const row = legends.find((candidate) => archiveLegendSlug(candidate) === input.slug);
      if (!row) {
        throw errors.NOT_FOUND({ message: "Legend not found" });
      }

      const page = input.page ?? 1;
      const [finishes, best, counts, images] = await Promise.all([
        meta.finishesForLegend(row.cardId, input, {
          limit: FINISH_PAGE_SIZE,
          offset: (page - 1) * FINISH_PAGE_SIZE,
        }),
        meta.bestFinishesForLegend(row.cardId, input, BEST_FINISH_COUNT),
        meta.legendRecordCounts(row.cardId, input),
        imageIdsForCards(canonicalPrintings, [row.cardId]),
      ]);
      const ref = toMetaLegendRef(row, images);

      return {
        slug: ref.slug,
        legend: ref.legend,
        counts,
        best: best.map((finish) => toMetaLegendFinish(finish)),
        finishes: finishes.rows.map((finish) => toMetaLegendFinish(finish)),
        total: finishes.total,
        page,
      };
    },
  ),

  player: os.player.handler(
    async ({ input, context, errors }): Promise<MetaPlayerDetailResponse> => {
      const { meta, canonicalPrintings } = context.repos;

      const finishes = await meta.finishesForPlayer(input.key);
      const newest = finishes[0];
      if (newest === undefined) {
        throw errors.NOT_FOUND({ message: "Player not found" });
      }
      const images = await imageIdsForCards(
        canonicalPrintings,
        finishes.map((finish) => finish.legendCardId).filter((id) => id !== null),
      );

      return {
        key: input.key,
        name: newest.playerName,
        finishes: finishes.map((finish) => toMetaPlayerFinish(finish, images)),
      };
    },
  ),

  counts: os.counts.handler(async ({ input, context }): Promise<MetaCountsResponse> => {
    const { meta } = context.repos;
    const [totalPlayers, decksWithMainDeck, tierCounts, latestResultDate] = await Promise.all([
      meta.playerCountInScope(input),
      meta.deckCountInScope(input),
      meta.eventTierCounts(),
      meta.latestResultDate(),
    ]);
    const totalEvents = Object.values(tierCounts.all).reduce((sum, count) => sum + count, 0);
    return {
      totalPlayers,
      decksWithMainDeck,
      totalEvents,
      latestResultDate,
      eventsByTier: tierCounts.all,
      eventsWithResultsByTier: tierCounts.withResults,
    };
  }),
};
