import type { DeckViolation } from "@openrift/shared/deck-rules";
import { validateDeck } from "@openrift/shared/deck-rules";
import type { DeckFormatConfig } from "@openrift/shared/types/api/deck";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { RUNE_TARGET, deckCardKey, toRuleEngineCard } from "@/features/decks/lib/deck-builder-card";

interface RuneChange {
  name: string;
  quantity: number;
}

interface LegendSwitchPreview {
  runesRemoved: RuneChange[];
  runesAdded: RuneChange[];
  runeTotalAfter: number;
  offColorCount: number;
  champion: DeckBuilderCard | null;
  championLegal: boolean;
  newViolations: DeckViolation[];
  resolvedViolations: DeckViolation[];
}

interface LegendSwitchContext {
  format: DeckFormat;
  formatConfig: DeckFormatConfig | null;
  championIdentifierTags: ReadonlySet<string>;
  customTagAssignments: Record<string, readonly string[]>;
}

const PER_DOMAIN = RUNE_TARGET / 2;

const DEDICATED_CODES = new Set(["DOMAIN_MISMATCH", "CHAMPION_LEGEND_MISMATCH"]);

export function runeRefillPlan(
  cards: DeckBuilderCard[],
  legendDomains: string[],
): Map<string, number> {
  const kept = cards.filter(
    (card) =>
      card.zone === WellKnown.deckZone.RUNES &&
      card.domains.every((domain) => legendDomains.includes(domain)),
  );
  const plan = new Map<string, number>();
  if (legendDomains.length < 2) {
    return plan;
  }
  for (const domain of legendDomains.slice(0, 2)) {
    const held = kept
      .filter((card) => card.domains.includes(domain))
      .reduce((sum, card) => sum + card.quantity, 0);
    if (held < PER_DOMAIN) {
      plan.set(domain, PER_DOMAIN - held);
    }
  }
  return plan;
}

function incrementOrInsert(
  cards: DeckBuilderCard[],
  card: DeckBuilderCard,
  zone: DeckZone,
  quantity: number,
): DeckBuilderCard[] {
  const key = deckCardKey(card.cardId, zone, null);
  const existing = cards.find(
    (entry) => deckCardKey(entry.cardId, entry.zone, entry.preferredPrintingId) === key,
  );
  if (existing) {
    return cards.map((entry) =>
      entry === existing ? { ...entry, quantity: entry.quantity + quantity } : entry,
    );
  }
  return [...cards, { ...card, zone, quantity, preferredPrintingId: null }];
}

function autoPopulateRunes(
  legendDomains: string[],
  runesByDomain: Map<string, DeckBuilderCard[]>,
): DeckBuilderCard[] {
  const entries = new Map<string, DeckBuilderCard>();
  for (const domain of legendDomains.slice(0, 2)) {
    const runes = runesByDomain.get(domain) ?? [];
    for (let index = 0; runes.length > 0 && index < PER_DOMAIN; index++) {
      const rune = runes[index % runes.length];
      if (!rune) {
        break;
      }
      const already = entries.get(rune.cardId);
      if (already) {
        already.quantity += 1;
      } else {
        entries.set(rune.cardId, {
          ...rune,
          zone: WellKnown.deckZone.RUNES,
          quantity: 1,
          preferredPrintingId: null,
        });
      }
    }
  }
  return [...entries.values()];
}

/** Mirrors `setLegendAction` with `refill: true` and no Overflow move, on a plain array. */
export function simulateLegendSwitch(
  cards: DeckBuilderCard[],
  legend: DeckBuilderCard,
  runesByDomain: Map<string, DeckBuilderCard[]>,
  format: DeckFormat,
): DeckBuilderCard[] {
  if (format === WellKnown.deckFormat.FREEFORM) {
    const existing = cards.find(
      (card) =>
        card.zone === WellKnown.deckZone.LEGEND &&
        card.cardId === legend.cardId &&
        card.preferredPrintingId === legend.preferredPrintingId,
    );
    return existing
      ? cards.map((card) => (card === existing ? { ...card, quantity: card.quantity + 1 } : card))
      : [...cards, { ...legend, zone: WellKnown.deckZone.LEGEND, quantity: 1 }];
  }

  const legendDomains = new Set<string>(legend.domains);
  let after = cards.filter(
    (card) =>
      card.zone !== WellKnown.deckZone.LEGEND &&
      !(
        card.zone === WellKnown.deckZone.RUNES &&
        !card.domains.every((domain) => legendDomains.has(domain))
      ),
  );
  after.push({ ...legend, zone: WellKnown.deckZone.LEGEND, quantity: 1 });

  const hasRunes = after.some((card) => card.zone === WellKnown.deckZone.RUNES);
  if (hasRunes) {
    for (const [domain, quantity] of runeRefillPlan(after, legend.domains)) {
      const [catalogRune] = runesByDomain.get(domain) ?? [];
      if (catalogRune) {
        after = incrementOrInsert(after, catalogRune, WellKnown.deckZone.RUNES, quantity);
      }
    }
    return after;
  }
  if (legend.domains.length < 2) {
    return after;
  }
  return [...after, ...autoPopulateRunes(legend.domains, runesByDomain)];
}

function runeQuantities(cards: DeckBuilderCard[]): Map<string, RuneChange> {
  const byCard = new Map<string, RuneChange>();
  for (const card of cards) {
    if (card.zone !== WellKnown.deckZone.RUNES) {
      continue;
    }
    const entry = byCard.get(card.cardId);
    byCard.set(card.cardId, {
      name: card.cardName,
      quantity: (entry?.quantity ?? 0) + card.quantity,
    });
  }
  return byCard;
}

function violationKey(violation: DeckViolation): string {
  return `${violation.code}|${violation.zone}|${violation.cardId ?? ""}`;
}

function withoutKeys(violations: DeckViolation[], other: DeckViolation[]): DeckViolation[] {
  const keys = new Set(other.map((violation) => violationKey(violation)));
  return violations.filter(
    (violation) => !keys.has(violationKey(violation)) && !DEDICATED_CODES.has(violation.code),
  );
}

export function previewLegendSwitch(
  cards: DeckBuilderCard[],
  legend: DeckBuilderCard,
  runesByDomain: Map<string, DeckBuilderCard[]>,
  context: LegendSwitchContext,
): LegendSwitchPreview {
  const after = simulateLegendSwitch(cards, legend, runesByDomain, context.format);
  const validate = (deck: DeckBuilderCard[]) =>
    validateDeck({
      format: context.format,
      formatConfig: context.formatConfig,
      cards: deck.map((card) => toRuleEngineCard(card, context.customTagAssignments)),
      championIdentifierTags: context.championIdentifierTags,
    });
  const violationsBefore = validate(cards);
  const violationsAfter = validate(after);

  const runesBefore = runeQuantities(cards);
  const runesAfter = runeQuantities(after);
  const runesRemoved: RuneChange[] = [];
  for (const [cardId, rune] of runesBefore) {
    const delta = rune.quantity - (runesAfter.get(cardId)?.quantity ?? 0);
    if (delta > 0) {
      runesRemoved.push({ name: rune.name, quantity: delta });
    }
  }
  const runesAdded: RuneChange[] = [];
  for (const [cardId, rune] of runesAfter) {
    const delta = rune.quantity - (runesBefore.get(cardId)?.quantity ?? 0);
    if (delta > 0) {
      runesAdded.push({ name: rune.name, quantity: delta });
    }
  }

  const offColorKeys = new Set(
    violationsAfter
      .filter((violation) => violation.code === "DOMAIN_MISMATCH")
      .map((violation) => `${violation.cardId}|${violation.zone}`),
  );
  const offColorCount = after
    .filter((card) => offColorKeys.has(`${card.cardId}|${card.zone}`))
    .reduce((sum, card) => sum + card.quantity, 0);

  const champion = after.find((card) => card.zone === WellKnown.deckZone.CHAMPION) ?? null;

  return {
    runesRemoved,
    runesAdded,
    runeTotalAfter: [...runesAfter.values()].reduce((sum, rune) => sum + rune.quantity, 0),
    offColorCount,
    champion,
    championLegal: !violationsAfter.some(
      (violation) => violation.code === "CHAMPION_LEGEND_MISMATCH",
    ),
    newViolations: withoutKeys(violationsAfter, violationsBefore),
    resolvedViolations: withoutKeys(violationsBefore, violationsAfter),
  };
}
