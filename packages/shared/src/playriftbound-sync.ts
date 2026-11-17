import { z } from "zod";

import { mapSectionToZone } from "./deck-check.js";

export const PLAYRIFTBOUND_EXTERNAL_ID_PREFIX = "playriftbound:";

export function playriftboundExternalId(playerId: string): string {
  return `${PLAYRIFTBOUND_EXTERNAL_ID_PREFIX}${playerId}`;
}

export const playriftboundEventIdSchema = z.string().regex(/^[1-9]\d{0,19}$/u);

const EVENT_PATH = /\/events\/(?<id>[1-9]\d{0,19})(?:[/?#]|$)/u;

export function parsePlayriftboundEventId(input: string): string | null {
  const trimmed = input.trim();
  if (playriftboundEventIdSchema.safeParse(trimmed).success) {
    return trimmed;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.hostname !== "playriftbound.com" && !url.hostname.endsWith(".playriftbound.com")) {
    return null;
  }
  return EVENT_PATH.exec(url.pathname)?.groups?.id ?? null;
}

export interface PlayriftboundDeckCard {
  name: string;
  quantity: number;
  section: string;
}

export interface PlayriftboundParsedDeck {
  cards: PlayriftboundDeckCard[];
  skipped: string[];
}

const SECTION_HEADER = /^(?<section>[^\d].*?):\s*$/u;
const CARD_LINE = /^(?<quantity>\d{1,2})\s+(?<name>\S.*)$/u;

/** Reads the `Section:` / `N Card Name` text a playriftbound deck submission stores. */
export function parsePlayriftboundDeckText(text: string): PlayriftboundParsedDeck {
  const cards: PlayriftboundDeckCard[] = [];
  const skipped: string[] = [];
  let section: string | null = null;
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim();
    if (line === "") {
      continue;
    }
    const header = SECTION_HEADER.exec(line)?.groups?.section;
    if (header !== undefined) {
      section = mapSectionToZone(header) === null ? null : header;
      if (section === null) {
        skipped.push(line);
      }
      continue;
    }
    const card = CARD_LINE.exec(line)?.groups;
    const quantity = card === undefined ? 0 : Number(card.quantity);
    if (section === null || card?.name === undefined || quantity < 1) {
      skipped.push(line);
      continue;
    }
    cards.push({ name: card.name.trim(), quantity, section });
  }
  return { cards, skipped };
}

export const playriftboundSyncDeckSchema = z.object({
  deckText: z.string().max(20_000),
  lastSavedAt: z.iso.datetime({ offset: true }),
});

export const playriftboundSyncRegistrantSchema = z.object({
  playerId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(120),
  tagLine: z.string().max(40).nullable(),
  dropped: z.boolean(),
  deck: playriftboundSyncDeckSchema.nullable(),
});

export const playriftboundSyncEventSchema = z.object({
  eventId: playriftboundEventIdSchema,
  name: z.string().min(1).max(300),
  startsAt: z.iso.datetime({ offset: true }),
});

export const playriftboundSyncPayloadSchema = z.object({
  event: playriftboundSyncEventSchema,
  registrants: z.array(playriftboundSyncRegistrantSchema).max(1000),
  readAt: z.iso.datetime({ offset: true }),
});

export type PlayriftboundSyncPayload = z.infer<typeof playriftboundSyncPayloadSchema>;
export type PlayriftboundSyncRegistrant = z.infer<typeof playriftboundSyncRegistrantSchema>;

/** Either side may load first: the page asks on mount and the extension also sends unasked. */
export const PLAYRIFTBOUND_HANDOFF = {
  request: "openrift:playriftbound-sync:request",
  payload: "openrift:playriftbound-sync:payload",
  received: "openrift:playriftbound-sync:received",
} as const;

export const PLAYRIFTBOUND_SYNC_PATH = "/tournaments/playriftbound-sync";

/** The payload travels as JSON text: Firefox does not hand objects from a content script to the page. */
export function readPlayriftboundHandoff(message: unknown): PlayriftboundSyncPayload | null {
  if (typeof message !== "object" || message === null) {
    return null;
  }
  const { type, payload } = message as { type?: unknown; payload?: unknown };
  if (type !== PLAYRIFTBOUND_HANDOFF.payload || typeof payload !== "string") {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return null;
  }
  const parsed = playriftboundSyncPayloadSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export interface PlayriftboundSyncSummary {
  registrants: number;
  decks: number;
  dropped: number;
  unreadable: number;
}

export function summarizePlayriftboundSync(
  payload: PlayriftboundSyncPayload,
): PlayriftboundSyncSummary {
  let decks = 0;
  let dropped = 0;
  let unreadable = 0;
  for (const registrant of payload.registrants) {
    if (registrant.dropped) {
      dropped += 1;
    }
    if (registrant.deck !== null) {
      decks += 1;
      if (parsePlayriftboundDeckText(registrant.deck.deckText).skipped.length > 0) {
        unreadable += 1;
      }
    }
  }
  return { registrants: payload.registrants.length, decks, dropped, unreadable };
}

const RIOT_ID_MAX = 120;

export function playriftboundRiotId(registrant: {
  displayName: string;
  tagLine: string | null;
}): string | null {
  if (registrant.tagLine === null || registrant.tagLine === "") {
    return null;
  }
  const riotId = `${registrant.displayName}#${registrant.tagLine}`;
  return riotId.length > RIOT_ID_MAX ? null : riotId;
}
