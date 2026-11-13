import { compareCardDisplayName, legendDisplayName } from "@openrift/shared/card-name";
import { buildCodeIndex } from "@openrift/shared/card-search";
import type { DeckImportEntry } from "@openrift/shared/deck-code";
import type { ResolvedDeckCodeRow } from "@openrift/shared/deck-code-resolve";
import { resolveDeckCodeEntries } from "@openrift/shared/deck-code-resolve";
import { deckCardCount } from "@openrift/shared/deck-rules";
import { DISCORD_EMBED_COLOR } from "@openrift/shared/discord-embed";
import { enumLabel } from "@openrift/shared/enum-label";
import type { DeckImageBody } from "@openrift/shared/share-image-params";
import { deckImportPath } from "@openrift/shared/site-paths";
import { truncateWithEllipsis, pluralize } from "@openrift/shared/strings";
import { WellKnown } from "@openrift/shared/well-known";
import type { APIEmbed } from "discord.js";

import type { CatalogCard, CatalogPrinting, CatalogSnapshot } from "./catalog-cache.js";
import { log } from "./log.js";

export interface ResolvedDeck {
  rows: ResolvedDeckCodeRow<CatalogCard, CatalogPrinting>[];
  unknownCodes: string[];
  totalCards: number;
}

export function resolveDeckEntries(
  snapshot: CatalogSnapshot,
  entries: DeckImportEntry[],
): ResolvedDeck {
  const cardsById = new Map(snapshot.cards.map((card) => [card.id, card]));
  const codeIndex = buildCodeIndex(
    [...snapshot.printingsByCardId.values()].flatMap((printings) =>
      printings.flatMap((printing) => {
        const card = cardsById.get(printing.cardId);
        return card ? [{ card, printing }] : [];
      }),
    ),
  );
  const { rows, unknownCodes } = resolveDeckCodeEntries(entries, codeIndex);

  return {
    rows,
    unknownCodes,
    totalCards: deckCardCount(
      rows.map((row) => ({ zone: row.zone, quantity: row.entry.quantity })),
    ),
  };
}

export function deckTitle(deck: ResolvedDeck): string {
  const legend = deck.rows.find((row) => row.zone === WellKnown.deckZone.LEGEND);
  if (legend) {
    return legendDisplayName(legend.card);
  }
  const champion = deck.rows.find((row) => row.zone === WellKnown.deckZone.CHAMPION);
  if (champion) {
    return legendDisplayName(champion.card);
  }
  return "Riftbound Deck";
}

/** Discord's hard cap on an embed description. */
const MAX_DESCRIPTION_LENGTH = 4096;

export function deckImportUrl(siteUrl: string, code: string): string {
  return `${siteUrl}${deckImportPath(code)}`;
}

export function buildDeckEmbed(input: {
  deck: ResolvedDeck;
  code: string;
  snapshot: CatalogSnapshot;
  siteUrl: string;
  imageAttachmentName?: string;
}): APIEmbed {
  const { deck, code, snapshot, siteUrl } = input;

  const rowsByZone = Map.groupBy(deck.rows, (row) => row.zone as string);
  const sections = snapshot.zoneOrder.flatMap((zone) => {
    const rows = rowsByZone.get(zone);
    if (!rows?.length) {
      return [];
    }
    const lines = rows
      .toSorted((a, b) => compareCardDisplayName(a.card, b.card))
      .map((row) => `${row.entry.quantity}× ${legendDisplayName(row.card)}`);
    return [`**${enumLabel(snapshot.labels.deckZones, zone)}**\n${lines.join("\n")}`];
  });
  if (deck.unknownCodes.length > 0) {
    sections.push(
      `*${deck.unknownCodes.length} ${pluralize(deck.unknownCodes.length, "card", "cards")} not in the catalog yet: ${deck.unknownCodes.join(", ")}*`,
    );
  }

  const description = truncateWithEllipsis(sections.join("\n\n"), MAX_DESCRIPTION_LENGTH);

  return {
    title: deckTitle(deck),
    url: deckImportUrl(siteUrl, code),
    description,
    color: DISCORD_EMBED_COLOR,
    footer: { text: `${deck.totalCards} cards` },
    ...(input.imageAttachmentName
      ? { image: { url: `attachment://${input.imageAttachmentName}` } }
      : {}),
  };
}

export async function fetchDeckImage(
  apiUrl: string,
  deck: ResolvedDeck,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array | null> {
  try {
    const response = await fetchImpl(`${apiUrl}/api/v1/decks/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deckName: deckTitle(deck),
        cards: deck.rows.map((row) => ({
          cardId: row.card.id,
          preferredPrintingId: row.printing.printingId,
          quantity: row.entry.quantity,
          zone: row.zone,
        })),
      } satisfies DeckImageBody),
    });
    if (!response.ok) {
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    log.error({ err: error }, "deck image render failed");
    return null;
  }
}
