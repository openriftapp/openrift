import { isAllowedLinkUrl } from "@openrift/shared/link-hosts";
import type { DeckFormatConfig, DeckLink } from "@openrift/shared/types/api/deck";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { LocalDeck, LocalDeckCard } from "@/features/decks/lib/local-deck";
import { LOCAL_DECK_PREFIX } from "@/features/decks/lib/local-deck";
import { m } from "@/paraglide/messages.js";

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeCards(raw: unknown): LocalDeckCard[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const cards: LocalDeckCard[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    // Zone stays an open string on purpose: a zone this bundle doesn't know
    // (written by a newer deploy) must survive the round-trip, not be dropped.
    if (typeof candidate.zone !== "string" || typeof candidate.cardId !== "string") {
      continue;
    }
    const quantity =
      typeof candidate.quantity === "number" && candidate.quantity >= 1
        ? Math.floor(candidate.quantity)
        : null;
    if (quantity === null) {
      continue;
    }
    cards.push({
      zone: candidate.zone as DeckZone,
      cardId: candidate.cardId,
      quantity,
      preferredPrintingId:
        typeof candidate.preferredPrintingId === "string" ? candidate.preferredPrintingId : null,
    });
  }
  return cards;
}

// Blobs written before links existed carry a single `videoUrl` string
// instead; that becomes the first entry.
function sanitizeLinks(candidate: Record<string, unknown>): DeckLink[] {
  if (Array.isArray(candidate.links)) {
    const links: DeckLink[] = [];
    for (const entry of candidate.links) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const link = entry as Record<string, unknown>;
      if (typeof link.url !== "string" || !isAllowedLinkUrl(link.url)) {
        continue;
      }
      links.push({
        url: link.url,
        ...(typeof link.title === "string" && link.title !== "" ? { title: link.title } : {}),
      });
    }
    return links;
  }
  if (typeof candidate.videoUrl === "string" && isAllowedLinkUrl(candidate.videoUrl)) {
    return [{ url: candidate.videoUrl, title: m.decks_dialog_local_video_guide() }];
  }
  return [];
}

/** Ids written before the store moved off the `local:` prefix keep the uuid they wrapped, so a bookmark can redirect to it. */
export function bareLocalDeckId(id: string): string {
  return id.startsWith(LOCAL_DECK_PREFIX) ? id.slice(LOCAL_DECK_PREFIX.length) : id;
}

// A malformed entry degrades to the valid subset; it does not crash /decks.
export function sanitizeDecks(raw: unknown): Record<string, LocalDeck> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const decks: Record<string, LocalDeck> = {};
  for (const [rawId, entry] of Object.entries(raw)) {
    const id = bareLocalDeckId(rawId);
    if (id === "" || !entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    const fallbackStamp = nowIso();
    decks[id] = {
      id,
      name:
        typeof candidate.name === "string" && candidate.name.trim() !== ""
          ? candidate.name
          : m.decks_dialog_local_recovered_name(),
      description: typeof candidate.description === "string" ? candidate.description : "",
      // Open string on purpose: a format this bundle doesn't know must survive.
      format:
        typeof candidate.format === "string" ? candidate.format : WellKnown.deckFormat.CONSTRUCTED,
      formatConfig:
        candidate.formatConfig && typeof candidate.formatConfig === "object"
          ? (candidate.formatConfig as DeckFormatConfig)
          : null,
      cards: sanitizeCards(candidate.cards),
      coverCardId: typeof candidate.coverCardId === "string" ? candidate.coverCardId : null,
      coverPrintingId:
        typeof candidate.coverPrintingId === "string" ? candidate.coverPrintingId : null,
      coverPosition:
        typeof candidate.coverPosition === "number" &&
        Number.isInteger(candidate.coverPosition) &&
        candidate.coverPosition >= 0 &&
        candidate.coverPosition <= 100
          ? candidate.coverPosition
          : null,
      links: sanitizeLinks(candidate),
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : fallbackStamp,
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : fallbackStamp,
    };
  }
  return decks;
}
