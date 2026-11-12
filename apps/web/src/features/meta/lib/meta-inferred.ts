import { legendDisplayName } from "@openrift/shared/card-name";
import { zoneExpected } from "@openrift/shared/deck-zones";
import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import type { MetaDeckInference, MetaListShape } from "@openrift/shared/types/api/meta";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import { describeIncompleteList } from "@/features/meta/lib/meta-deck-archive";
import { m } from "@/paraglide/messages.js";

export type ShapeSegmentState = "known" | "inferred" | "unknown";

export interface ShapeSegment {
  key: string;
  zone: DeckZone;
  state: ShapeSegmentState;
  fill?: number;
}

export interface InferredCopyOption {
  label: string;
  description: string;
  cards: PublicDeckCardResponse[];
}

export function inferredCards(inferred: MetaDeckInference | null): PublicDeckCardResponse[] {
  if (inferred === null) {
    return [];
  }
  return [...inferred.champions, ...(inferred.battlefield === null ? [] : [inferred.battlefield])];
}

export function inferredCardLabel(card: PublicDeckCardResponse): string {
  return legendDisplayName({ name: card.cardName, types: card.cardTypes, tags: card.tags });
}

export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  return m.meta_join_and({ names: names.slice(0, -1).join(", "), last: names.at(-1) ?? "" });
}

export function eitherName(names: readonly string[]): string | null {
  const [first, second] = names;
  if (first === undefined) {
    return null;
  }
  return second === undefined ? first : m.meta_inferred_either({ first, second });
}

export function inferredCopyNames(cards: readonly PublicDeckCardResponse[]): string {
  return joinNames(cards.map((card) => inferredCardLabel(card)));
}

export function inferredSummary(inferred: MetaDeckInference | null): string {
  if (inferred === null) {
    return "";
  }
  const champion = eitherName(inferred.champions.map((card) => inferredCardLabel(card)));
  const battlefield =
    inferred.battlefield === null ? null : inferredCardLabel(inferred.battlefield);
  return joinNames([champion, battlefield].filter((name) => name !== null));
}

export function inferredCopyOptions(inferred: MetaDeckInference | null): InferredCopyOption[] {
  if (inferred === null) {
    return [];
  }
  const battlefield = inferred.battlefield === null ? [] : [inferred.battlefield];
  const option = (cards: PublicDeckCardResponse[], label: string): InferredCopyOption => ({
    label,
    description: m.meta_copy_with_inferred_desc({ cards: inferredCopyNames(cards) }),
    cards,
  });
  if (inferred.champions.length === 0) {
    return battlefield.length === 0
      ? []
      : [option(battlefield, m.meta_copy_with_inferred_battlefield())];
  }
  if (inferred.champions.length === 1) {
    return [
      option(
        [...inferred.champions, ...battlefield],
        battlefield.length === 0
          ? m.meta_copy_with_inferred_champion()
          : m.meta_copy_with_inferred_both(),
      ),
    ];
  }
  return inferred.champions.map((champion) =>
    option(
      [champion, ...battlefield],
      m.meta_copy_with_champion({ name: inferredCardLabel(champion) }),
    ),
  );
}

const BAR_ZONES = new Set<DeckZone>([WellKnown.deckZone.MAIN, WellKnown.deckZone.RUNES]);

const SHAPE_ZONES = [
  WellKnown.deckZone.LEGEND,
  WellKnown.deckZone.CHAMPION,
  WellKnown.deckZone.BATTLEFIELD,
  WellKnown.deckZone.MAIN,
  WellKnown.deckZone.RUNES,
] as const;

function heldIn(shape: MetaListShape, zone: (typeof SHAPE_ZONES)[number]): number {
  return shape[zone];
}

export function listShapeSegments(shape: MetaListShape): ShapeSegment[] {
  const { format } = shape;
  const segments: ShapeSegment[] = [];
  for (const zone of SHAPE_ZONES) {
    const expected = zoneExpected(zone, format) ?? 0;
    const held = Math.min(heldIn(shape, zone), expected);
    if (BAR_ZONES.has(zone)) {
      segments.push({
        key: zone,
        zone,
        state: held >= expected ? "known" : "unknown",
        fill: expected === 0 ? 1 : held / expected,
      });
      continue;
    }
    const guessed =
      (zone === WellKnown.deckZone.CHAMPION && shape.inferredChampion) ||
      (zone === WellKnown.deckZone.BATTLEFIELD && shape.inferredBattlefield)
        ? 1
        : 0;
    for (let slot = 0; slot < expected; slot++) {
      let state: ShapeSegmentState = "unknown";
      if (slot < held) {
        state = "known";
      } else if (slot < held + guessed) {
        state = "inferred";
      }
      segments.push({ key: `${zone}-${slot}`, zone, state });
    }
  }
  return segments;
}

export function describeListShape(shape: MetaListShape): string {
  const { format } = shape;
  const unknown = new Map<DeckZone, number>();
  for (const zone of SHAPE_ZONES) {
    const expected = zoneExpected(zone, format);
    if (expected !== undefined && heldIn(shape, zone) < expected) {
      unknown.set(zone, expected - heldIn(shape, zone));
    }
  }
  const base = describeIncompleteList(format, unknown) ?? "";
  const guessed = [
    ...(shape.inferredChampion ? [m.meta_zone_noun_champion()] : []),
    ...(shape.inferredBattlefield ? [m.meta_inferred_one_battlefield()] : []),
  ];
  if (guessed.length === 0) {
    return base;
  }
  const parts =
    guessed.length === 1
      ? (guessed[0] ?? "")
      : m.meta_join_and({ names: guessed[0] ?? "", last: guessed[1] ?? "" });
  return `${base} ${m.meta_shape_inferred({ parts })}`.trim();
}
