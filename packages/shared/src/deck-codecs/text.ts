import type { DeckCodeParseResult, DeckImportEntry } from "../deck-code.js";
import { straightenApostrophes } from "../strings.js";
import type { DeckZone } from "../types/enums.js";
import { WellKnown } from "../well-known.js";
import { sourceSlotForZone } from "../zone-inference.js";
import type { DeckCodecCard, EncodeResult } from "./types.js";

/** `aliases` must be lowercase: lookups only lowercase the incoming header, not aliases. */
const TEXT_ZONE_SECTIONS: readonly {
  zone: DeckZone;
  header: string;
  aliases: readonly string[];
}[] = [
  { zone: WellKnown.deckZone.LEGEND, header: "Legend", aliases: [] },
  {
    zone: WellKnown.deckZone.LEGEND_OPTIONS,
    header: "LegendOptions",
    aliases: ["legend options", "additional legends"],
  },
  { zone: WellKnown.deckZone.CHAMPION, header: "Champion", aliases: [] },
  {
    zone: WellKnown.deckZone.MAIN,
    header: "MainDeck",
    aliases: ["main deck", "main", "mainboard"],
  },
  { zone: WellKnown.deckZone.BATTLEFIELD, header: "Battlefields", aliases: ["battlefield"] },
  { zone: WellKnown.deckZone.RUNES, header: "Runes", aliases: ["rune pool"] },
  { zone: WellKnown.deckZone.SIDEBOARD, header: "Sideboard", aliases: [] },
  { zone: WellKnown.deckZone.OVERFLOW, header: "Overflow", aliases: [] },
];

/** Overflow is excluded: it is never part of an exported deck, only accepted on read. */
const ZONE_ORDER: readonly DeckZone[] = TEXT_ZONE_SECTIONS.filter(
  (section) => section.zone !== WellKnown.deckZone.OVERFLOW,
).map((section) => section.zone);

const ZONE_HEADERS: Record<string, string> = Object.fromEntries(
  TEXT_ZONE_SECTIONS.map((section) => [section.zone, section.header]),
);

const HEADER_TO_ZONE: Record<string, DeckZone> = Object.fromEntries(
  TEXT_ZONE_SECTIONS.flatMap((section) =>
    [section.header.toLowerCase(), ...section.aliases].map((spelling) => [spelling, section.zone]),
  ),
);

/** Callers that only have names (e.g. an extension extracting a decklist) can encode without the resolved-card fields. */
export type TextEncodableCard = Pick<DeckCodecCard, "cardName" | "quantity" | "zone" | "inferred">;

export const TEXT_INFERRED_COMMENT = "// inferred, not on the published list";

const COMMENT_PREFIX = "//";

export function encodeText(cards: TextEncodableCard[]): EncodeResult {
  const warnings: string[] = [];
  const grouped = Map.groupBy(cards, (card) => card.zone);
  const lines: string[] = [];

  for (const zone of ZONE_ORDER) {
    const zoneCards = grouped.get(zone);
    if (!zoneCards || zoneCards.length === 0) {
      continue;
    }

    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(`${ZONE_HEADERS[zone]}:`);
    for (const card of zoneCards) {
      if (card.inferred === true) {
        lines.push(TEXT_INFERRED_COMMENT);
      }
      lines.push(`${card.quantity} ${straightenApostrophes(card.cardName)}`);
    }
  }

  return { code: lines.join("\n"), warnings };
}

/**
 * Zone headers come in two spellings: our own `Legend:` and the markdown
 * strikethrough `~~Legend~~` that topdeck.gg exports.
 */
function headerTextOf(line: string): string | undefined {
  if (line.startsWith("~~") && line.endsWith("~~") && line.length > 4) {
    return line.slice(2, -2).trim();
  }
  if (line.endsWith(":")) {
    return line.slice(0, -1).trim();
  }
  return undefined;
}

const QUANTITY_LINE = /^(?:(?<count>\d+)\s*[x×]?|[x×]\s*(?<prefixedCount>\d+))\s+(?<name>.+)$/iu;
const URL_LINE = /^https?:\/\/\S+$/iu;
const CODE_SHAPE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*(?:\/\d+)?[a-z]?\*?$/u;

/** Without a catalog to ask, a code needs a digit: `SC` and `EN` are languages, not codes. */
export function looksLikePrintingCode(segment: string): boolean {
  return CODE_SHAPE.test(segment) && /\d/u.test(segment);
}

export function isUrlLine(line: string): boolean {
  return URL_LINE.test(line);
}

export interface CardListLine {
  quantity: number | null;
  name: string;
  pairedName?: string;
  code?: string;
  trailing: string[];
}

export function parseCardListLine(
  line: string,
  isCode: (segment: string) => boolean = looksLikePrintingCode,
): CardListLine {
  const match = QUANTITY_LINE.exec(line);
  const count = match?.groups?.count ?? match?.groups?.prefixedCount;
  const [namePart = "", ...trailing] = (match?.groups?.name ?? line).split(" · ");
  const [name = "", pairedName] = namePart.split(" // ");
  const segments = trailing.map((segment) => segment.trim()).filter(Boolean);
  const code = segments[0] !== undefined && isCode(segments[0]) ? segments[0] : undefined;
  return {
    quantity: count === undefined ? null : Number(count),
    name: name.trim(),
    ...(pairedName !== undefined && pairedName.trim() !== "" && { pairedName: pairedName.trim() }),
    ...(code !== undefined && { code }),
    trailing: segments,
  };
}

/**
 * Lines are `{quantity} {card name}` under an optional zone header; a bare
 * line with no leading count is treated as quantity 1.
 */
export function parseTextFormat(code: string): DeckCodeParseResult {
  const warnings: string[] = [];
  const entries: DeckImportEntry[] = [];
  let currentZone: DeckZone | undefined;
  let currentHeader: string | undefined;

  for (const rawLine of code.split("\n")) {
    const line = rawLine.trim();
    if (line === "") {
      continue;
    }

    const headerText = headerTextOf(line);
    if (headerText !== undefined) {
      const zone = HEADER_TO_ZONE[headerText.toLowerCase()];
      if (zone) {
        currentZone = zone;
        currentHeader = headerText;
      } else {
        // Unknown header clears the current zone; it must not inherit the prior zone.
        currentZone = undefined;
        currentHeader = undefined;
        warnings.push(`Unknown zone header: ${line}`);
      }
      continue;
    }

    if (isUrlLine(line) || line.startsWith(COMMENT_PREFIX)) {
      continue;
    }

    const parsed = parseCardListLine(line);
    const effectiveZone = currentZone ?? WellKnown.deckZone.MAIN;
    const quantity = parsed.quantity ?? 1;
    const cardName = parsed.name;
    const shortCode = parsed.code;
    entries.push({
      ...(shortCode && { shortCode }),
      cardName,
      quantity,
      sourceSlot: sourceSlotForZone(effectiveZone),
      // Only set explicitZone when a zone header was provided by the user.
      // Without it, inferZone() assigns the correct zone based on card type.
      explicitZone: currentZone,
      rawFields: {
        "Parsed Name": cardName,
        ...(currentHeader !== undefined && { Zone: currentHeader }),
      },
    });
  }

  return { entries, warnings };
}
