export interface PlayriftboundOrganizerEvent {
  orgId: string;
  eventId: string;
}

const ORGANIZER_EVENT_PATH =
  /^\/[\w-]+\/org\/(?<orgId>[\w-]+)\/events\/(?<eventId>[1-9]\d{0,19})(?:\/|$)/u;

/** The organizer's own view of an event, the one page whose session may read its decks. */
export function playriftboundOrganizerEvent(url: string): PlayriftboundOrganizerEvent | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.hostname !== "rgn.playriftbound.com") {
    return undefined;
  }
  const groups = ORGANIZER_EVENT_PATH.exec(parsed.pathname)?.groups;
  return groups?.orgId === undefined || groups.eventId === undefined
    ? undefined
    : { orgId: groups.orgId, eventId: groups.eventId };
}

export type PlayriftboundReadResult = { ok: true; payload: unknown } | { ok: false; error: string };

/** Serialized into the page's own context, so it may use nothing from outside its body. */
export async function readPlayriftboundEvent(
  orgId: string,
  eventId: string,
): Promise<PlayriftboundReadResult> {
  const EVENT_QUERY = "GetCompeteTournamentForRiftboundAdmin";
  const DECK_QUERY = "RiftboundDeckSubmissionForOrganizer";

  type Json = Record<string, unknown>;
  const record = (value: unknown): Json | undefined =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Json)
      : undefined;
  const list = (value: unknown): Json[] =>
    Array.isArray(value)
      ? value.flatMap((item: unknown): Json[] => {
          const row = record(item);
          return row === undefined ? [] : [row];
        })
      : [];
  const text = (value: unknown): string | null =>
    typeof value === "string" && value !== "" ? value : null;

  // The site answers persisted queries only; their ids live in a manifest one of its scripts ships.
  const scriptUrls = new Set<string>();
  for (const script of document.scripts) {
    if (script.src !== "") {
      scriptUrls.add(script.src);
    }
  }
  for (const entry of performance.getEntriesByType("resource")) {
    if (entry.name.endsWith(".js")) {
      scriptUrls.add(entry.name);
    }
  }
  const ids = new Map<string, string>();
  for (const url of scriptUrls) {
    if (ids.size === 2) {
      break;
    }
    let source: string;
    try {
      const response = await fetch(url);
      source = await response.text();
    } catch {
      continue;
    }
    for (const name of [EVENT_QUERY, DECK_QUERY]) {
      const id = new RegExp(`\\{"id":"([0-9a-f]{64})","name":"${name}"`, "u").exec(source)?.[1];
      if (id !== undefined) {
        ids.set(name, id);
      }
    }
  }
  const eventQueryId = ids.get(EVENT_QUERY);
  const deckQueryId = ids.get(DECK_QUERY);
  if (eventQueryId === undefined || deckQueryId === undefined) {
    return {
      ok: false,
      error: "Could not find the site's query list. Reload the event page and try again.",
    };
  }

  const query = async (
    operationName: string,
    sha256Hash: string,
    variables: Json,
  ): Promise<Json | string> => {
    const params = new URLSearchParams({
      operationName,
      variables: JSON.stringify(variables),
      extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash } }),
    });
    const response = await fetch(`/api/gql?${params.toString()}`, {
      credentials: "include",
      headers: {
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
        "apollographql-client-name": "Esports Web",
        // The site checks that the header is there, not its value.
        "apollographql-client-version": "openrift",
        "x-organizer-id": orgId,
        authorization: "Cookie __Secure-access_token",
      },
    });
    const body = record(await response.json());
    const errors = list(body?.errors);
    if (!response.ok || errors.length > 0) {
      return `${operationName}: ${text(errors[0]?.message) ?? `HTTP ${response.status}`}`;
    }
    return record(body?.data) ?? {};
  };

  try {
    const data = await query(EVENT_QUERY, eventQueryId, {
      tournamentId: eventId,
      includeAdminFields: true,
    });
    if (typeof data === "string") {
      return { ok: false, error: data };
    }
    const tournament = record(data.competeTournamentForOrganizer);
    const name = text(tournament?.name);
    const startsAt = text(tournament?.startsAt);
    if (tournament === undefined || name === null || startsAt === null) {
      return { ok: false, error: "The site did not return this event. Are you its organizer?" };
    }

    interface Player {
      playerId: string;
      displayName: string;
      tagLine: string | null;
      dropped: boolean;
      hasDeck: boolean;
    }
    const players = new Map<string, Player>();
    const take = (row: Json, inField: boolean, dropped: boolean) => {
      const player = record(row.player);
      const playerId = text(player?.id);
      const displayName = text(player?.displayName);
      if (playerId === null || displayName === null) {
        return;
      }
      const known = players.get(playerId);
      if (known === undefined && !inField) {
        return;
      }
      players.set(playerId, {
        playerId,
        displayName,
        tagLine: text(player?.tagLine),
        dropped: (known?.dropped ?? false) || dropped,
        hasDeck: (known?.hasDeck ?? false) || record(row.deckSubmission) !== undefined,
      });
    };
    const registered = list(tournament.tournamentRegistrants).filter(
      (row) => String(row.status).toUpperCase() === "REGISTERED",
    );
    const expected = list(tournament.registrantCounts).find(
      (row) => String(row.status).toUpperCase() === "REGISTERED",
    )?.count;
    // A sync drops whoever is missing, so a partial roster must not get through.
    if (typeof expected === "number" && registered.length < expected) {
      return {
        ok: false,
        error: `The site listed ${registered.length} of ${expected} registered players. Reload the event page and try again.`,
      };
    }
    for (const row of registered) {
      take(row, true, false);
    }
    for (const row of list(tournament.tournamentParticipants)) {
      take(row, true, String(row.status).toUpperCase() === "DROPPED");
    }

    const registrants = [];
    for (const player of players.values()) {
      let deck: { deckText: string; lastSavedAt: string } | null = null;
      if (player.hasDeck) {
        const deckData = await query(DECK_QUERY, deckQueryId, {
          esportsTournamentId: eventId,
          playerId: player.playerId,
        });
        if (typeof deckData === "string") {
          return { ok: false, error: deckData };
        }
        const submission = record(deckData.riftboundDeckSubmissionForOrganizer);
        const deckText = typeof submission?.deckText === "string" ? submission.deckText : null;
        const lastSavedAt = text(submission?.lastSavedAt);
        // A sync reads a missing list as no list, so a submission that will not load stops the read.
        if (deckText === null || lastSavedAt === null) {
          return { ok: false, error: `Could not read the deck of ${player.displayName}.` };
        }
        deck = { deckText, lastSavedAt };
      }
      registrants.push({
        playerId: player.playerId,
        displayName: player.displayName,
        tagLine: player.tagLine,
        dropped: player.dropped,
        deck,
      });
    }

    return {
      ok: true,
      payload: {
        event: { eventId, name, startsAt },
        registrants,
        readAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    // A network failure: the shared error helpers cannot reach a serialized function.
    return { ok: false, error: String(error) };
  }
}
