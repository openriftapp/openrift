import { ERROR_CODES } from "@openrift/shared/error-codes";
import type { MetaEventOverlayField, MetaOverlayStatus } from "@openrift/shared/types/enums";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { TOURNAMENT_LIST_PROVIDER, UVSGAMES_PROVIDER } from "../../../lib/meta-providers.js";
import {
  mapSourceFormat,
  uvsgamesStandingIdentity,
  venueLocalDay,
} from "../lib/uvsgames-catalog.js";
import { listStatusFor } from "../lib/uvsgames-transform.js";
import type { UvsgamesListRow } from "../repositories/uvsgames-events.js";
import { playerSourceKey } from "./ingest-meta-overlays.js";

/**
 * ADR-052: an organizer sends a hosted tournament's lists onto the standings
 * of the UVS Games event it also ran as. Each list is a pending standings
 * overlay claiming only the list, so the official standings stay the source
 * and nothing is public before an admin accepts it.
 */

export interface TournamentListStanding {
  identity: string;
  rank: number;
  playerName: string | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  sentStatus: MetaOverlayStatus | null;
}

export interface TournamentListTarget {
  event: UvsgamesListRow;
  standings: TournamentListStanding[];
  metaEvent: { id: string; slug: string } | null;
}

export async function loadTournamentListTarget(
  repos: Repos,
  uvsgamesEventId: string,
): Promise<TournamentListTarget | null> {
  const event = await repos.uvsgamesEvents.byKey(uvsgamesEventId);
  if (event === undefined) {
    return null;
  }
  const [named, metaEvent] = await Promise.all([
    repos.uvsgamesResults.namedStandings(uvsgamesEventId),
    repos.meta.eventBySourceKey(UVSGAMES_PROVIDER, uvsgamesEventId),
  ]);
  const ranked = named.filter((row) => row.rank !== null);
  const identities = ranked.map((row) => uvsgamesStandingIdentity(row));
  const sent = await repos.metaOverlays.playerOverlaysBySourceKeys(
    TOURNAMENT_LIST_PROVIDER,
    identities.map((identity) => playerSourceKey(uvsgamesEventId, identity)),
  );
  const sentByKey = new Map(sent.map((overlay) => [overlay.sourcePlayerKey, overlay.status]));

  return {
    event,
    metaEvent: metaEvent === undefined ? null : { id: metaEvent.id, slug: metaEvent.slug },
    standings: ranked.map((row, index) => {
      const identity = identities[index] ?? uvsgamesStandingIdentity(row);
      return {
        identity,
        rank: row.rank ?? 0,
        playerName: row.playerName,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        sentStatus: sentByKey.get(playerSourceKey(uvsgamesEventId, identity)) ?? null,
      };
    }),
  };
}

export interface TournamentListCard {
  zone: string;
  quantity: number;
  cardName: string;
  cardId: string | null;
  preferredPrintingId: string | null;
}

export interface TournamentListInput {
  identity: string;
  cards: readonly TournamentListCard[];
}

export interface SendTournamentListsArgs {
  userId: string;
  tournamentName: string;
  uvsgamesEventId: string;
  fallbackFormat: string | null;
  lists: readonly TournamentListInput[];
}

export type TournamentListSkipReason = "settled" | "unknown_standing";

export interface SendTournamentListsResult {
  eventName: string;
  sent: number;
  updated: number;
  skipped: { identity: string; reason: TournamentListSkipReason }[];
}

const COMPLETE = "complete";

const PROPOSAL_FIELDS: readonly MetaEventOverlayField[] = [
  "name",
  "eventDate",
  "format",
  "playerCount",
  "organizer",
];

/** Keyed by the UVS Games id, so a tournament's lists group under it as one upload. */
async function proposalFor(
  repos: Repos,
  event: UvsgamesListRow,
  args: SendTournamentListsArgs,
  note: string,
): Promise<string> {
  const [existing] = await repos.metaOverlays.eventOverlaysBySourceKeys(TOURNAMENT_LIST_PROVIDER, [
    event.externalId,
  ]);
  if (existing !== undefined) {
    if (existing.status === "rejected") {
      await repos.metaOverlays.updateEventOverlay(existing.id, {
        status: "pending",
        acceptedAt: null,
      });
    }
    return existing.id;
  }

  const mappings = await repos.uvsgamesEvents.formatMappings();
  const format = mapSourceFormat(mappings, event.eventFormat) ?? args.fallbackFormat;
  const organizer = event.storeName === null ? null : event.storeName.slice(0, 120);
  const playerCount =
    event.playerCount !== null && event.playerCount > 0 ? event.playerCount : null;
  const values = {
    name: event.name.slice(0, 120),
    eventDate: venueLocalDay(event.startAt, event.timezone),
    format,
    playerCount,
    organizer,
  };
  return await repos.metaOverlays.insertEventOverlay({
    provider: TOURNAMENT_LIST_PROVIDER,
    externalId: event.externalId,
    metaEventId: null,
    ...values,
    notes: null,
    tier: null,
    country: null,
    location: null,
    claimedFields: PROPOSAL_FIELDS.filter((field) => values[field as keyof typeof values] !== null),
    submittedByUserId: args.userId,
    submissionNote: note,
  });
}

export async function sendTournamentLists(
  transact: Transact,
  args: SendTournamentListsArgs,
): Promise<SendTournamentListsResult> {
  return await transact(async (repos) => {
    const target = await loadTournamentListTarget(repos, args.uvsgamesEventId);
    if (target === null) {
      throw new AppError(
        409,
        ERROR_CODES.CONFLICT,
        "Load the UVS Games standings before sending lists.",
      );
    }
    if (target.event.displayStatus !== COMPLETE) {
      throw new AppError(
        409,
        ERROR_CODES.CONFLICT,
        "UVS Games has not published the final standings for this event yet.",
      );
    }
    const note = `Sent from the OpenRift tournament "${args.tournamentName}".`;
    const listNote = (standing: TournamentListStanding): string =>
      `Sent from the OpenRift tournament "${args.tournamentName}" for ${
        standing.playerName ?? "an unnamed player"
      }, rank ${standing.rank} on UVS Games.`;
    const standings = new Map(target.standings.map((row) => [row.identity, row]));

    let eventOverlayId: string | null = null;
    let liveRows = new Map<string | null, string>();
    if (target.metaEvent === null) {
      eventOverlayId = await proposalFor(repos, target.event, args, note);
    } else {
      const rows = await repos.meta.rawStandingsForEvent(target.metaEvent.id);
      liveRows = new Map(rows.map((row) => [row.sourceIdentity, row.id]));
    }

    const keys = args.lists.map((list) => playerSourceKey(args.uvsgamesEventId, list.identity));
    const priorOverlays = await repos.metaOverlays.playerOverlaysBySourceKeys(
      TOURNAMENT_LIST_PROVIDER,
      keys,
    );
    const existing = new Map(priorOverlays.map((overlay) => [overlay.sourcePlayerKey, overlay]));

    const result: SendTournamentListsResult = {
      eventName: target.event.name,
      sent: 0,
      updated: 0,
      skipped: [],
    };
    for (const list of args.lists) {
      const standing = standings.get(list.identity);
      const metaEventPlayerId = liveRows.get(list.identity) ?? null;
      if (standing === undefined || (target.metaEvent !== null && metaEventPlayerId === null)) {
        result.skipped.push({ identity: list.identity, reason: "unknown_standing" });
        continue;
      }
      const key = playerSourceKey(args.uvsgamesEventId, list.identity);
      const anchor =
        eventOverlayId === null
          ? { metaEventPlayerId, metaEventId: null, eventOverlayId: null }
          : { metaEventPlayerId: null, metaEventId: null, eventOverlayId };
      const cards = list.cards.map((card, index) => ({
        lineNumber: index,
        zone: card.zone,
        quantity: card.quantity,
        cardName: card.cardName,
        cardId: card.cardId,
        preferredPrintingId: card.preferredPrintingId,
      }));
      const listStatus = listStatusFor(
        list.cards.map((card) => ({
          name: card.cardName,
          zone: card.zone,
          quantity: card.quantity,
        })),
        null,
      );

      const prior = existing.get(key);
      if (prior !== undefined) {
        if (prior.status !== "pending") {
          result.skipped.push({ identity: list.identity, reason: "settled" });
          continue;
        }
        await repos.metaOverlays.updatePlayerOverlay(
          prior.id,
          { ...anchor, listStatus, submissionNote: listNote(standing) },
          cards,
        );
        result.updated++;
        continue;
      }

      const playerOverlayId = await repos.metaOverlays.insertPlayerOverlay(
        {
          ...anchor,
          provider: TOURNAMENT_LIST_PROVIDER,
          sourcePlayerKey: key,
          listStatus,
          claimedFields: ["listStatus", "cards"],
          submittedByUserId: args.userId,
          submissionNote: listNote(standing),
        },
        cards,
      );
      await repos.metaSubmissions.insert({
        userId: args.userId,
        provider: TOURNAMENT_LIST_PROVIDER,
        externalId: key,
        playerOverlayId,
        metaEventId: target.metaEvent?.id ?? null,
        metaEventPlayerId,
        eventName: target.event.name.slice(0, 120),
        playerName: (standing.playerName ?? `#${standing.rank}`).slice(0, 80),
        kind: "new_list",
        note: listNote(standing),
      });
      result.sent++;
    }
    return result;
  });
}
