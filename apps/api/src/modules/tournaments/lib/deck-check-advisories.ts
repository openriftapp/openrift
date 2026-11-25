import { primaryCardType } from "@openrift/shared/card-primary-type";
import { formatIgnoresBans, validateDeck } from "@openrift/shared/deck-rules";
import type { DeckViolation } from "@openrift/shared/deck-rules";
import { formatDay, todayUtc } from "@openrift/shared/format-date";
import {
  cardIdsBannedIn,
  cardSetLegality,
  setWindowFormatFor,
} from "@openrift/shared/format-legality";
import type { DeckCheckMatchStatus, ZoneSuggestion } from "@openrift/shared/types/api/deck-check";
import type { TournamentPlayMode } from "@openrift/shared/types/api/tournament";
import type { CardType, DeckZone, Domain, SuperType } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { inferZone } from "@openrift/shared/zone-inference";

import type { Repos } from "../../../deps.js";
import { toFormatSetWindow } from "../../catalog/lib/format-set-presenters.js";

/**
 * The card-line shape the advisory computation needs: satisfied both by stored
 * `deck_check_entry_cards` rows and by not-yet-persisted submission previews.
 */
export interface AdvisoryCardLine {
  id?: string;
  rawName: string;
  zone: string;
  quantity: number;
  resolvedCardId: string | null;
  matchStatus: DeckCheckMatchStatus;
}

export interface EntryAdvisories {
  violations: DeckViolation[];
  typeCounts: { cardType: CardType; count: number }[];
  domainDistribution: { domain: Domain; count: number }[];
  zoneSuggestions: ZoneSuggestion[];
}

interface CardDetail {
  name: string;
  types: string[];
  superTypes: string[];
}

/** The only zones {@link computeZoneSuggestions} checks a card's type against. */
const TYPE_LOCKED_ZONES = new Set<string>([
  WellKnown.deckZone.LEGEND,
  WellKnown.deckZone.LEGEND_OPTIONS,
  WellKnown.deckZone.RUNES,
  WellKnown.deckZone.BATTLEFIELD,
]);

/** A checked (imported) list carries no region/tag config, so these fire as noise without this filter. */
const REGION_CONFIG_CODES = new Set<string>(["FORMAT_TAG_REQUIRED", "CARD_NOT_IN_FORMAT_TAG"]);

/**
 * Only suggests moves into or out of a type-locked zone; moves among the
 * non-locked zones are a deckbuilding choice and are left alone.
 */
export function computeZoneSuggestions(
  cards: AdvisoryCardLine[],
  details: Map<string, CardDetail>,
): ZoneSuggestion[] {
  const suggestions: ZoneSuggestion[] = [];
  for (const card of cards) {
    if (!card.id || card.matchStatus !== "matched" || !card.resolvedCardId) {
      continue;
    }
    const detail = details.get(card.resolvedCardId);
    if (!detail) {
      continue;
    }
    const suggestedZone = inferZone(
      detail.types as CardType[],
      detail.superTypes as SuperType[],
      "mainDeck",
    );
    if (
      suggestedZone === card.zone ||
      (suggestedZone === WellKnown.deckZone.LEGEND &&
        card.zone === WellKnown.deckZone.LEGEND_OPTIONS)
    ) {
      continue;
    }
    if (!TYPE_LOCKED_ZONES.has(suggestedZone) && !TYPE_LOCKED_ZONES.has(card.zone)) {
      continue;
    }
    suggestions.push({
      cardId: card.id,
      cardName: detail.name,
      currentZone: card.zone as DeckZone,
      suggestedZone,
    });
  }
  return suggestions;
}

/** Type counts use main+champion zones only; legend/rune/battlefield types are excluded. */
export async function buildEntryAdvisories(
  repos: Repos,
  event: {
    format: string;
    playMode: TournamentPlayMode;
    allowedSets: string[] | null;
    eventDate: Date | null;
    circuit: string | null;
  },
  cards: AdvisoryCardLine[],
): Promise<EntryAdvisories> {
  const matchedIds = [
    ...new Set(
      cards.flatMap((card) =>
        card.matchStatus === "matched" && card.resolvedCardId ? [card.resolvedCardId] : [],
      ),
    ),
  ];
  const freeform = event.format === WellKnown.deckFormat.FREEFORM;
  // A list is judged by the bans of the day it is played, including ones lifted since.
  const eventDay = event.eventDate === null ? todayUtc() : formatDay(event.eventDate);
  const banFormatId =
    event.playMode === "2v2" ? WellKnown.banFormat.TWO_V_TWO : WellKnown.banFormat.CONSTRUCTED;
  const banFormatIds = formatIgnoresBans(event.format) ? [] : [banFormatId];
  const scope = { day: eventDay, ...(event.circuit === null ? {} : { circuit: event.circuit }) };
  // An event's own set list replaces the format's set windows.
  const hasAllowedSets = event.allowedSets !== null && event.allowedSets.length > 0;
  const windowFormat = hasAllowedSets ? undefined : setWindowFormatFor(event.format);
  const [enumRows, details, championIdentifierTags, banRows, numberedSets, windowRows] =
    await Promise.all([
      repos.enums.all(),
      repos.deckCheck.getCardDetails(matchedIds),
      // Only Custom-Region's signature rule consumes the champion-identifier
      // tag set — skip the query for every other format.
      event.format === WellKnown.deckFormat.CUSTOM_REGION
        ? repos.catalog.championIdentifierTags()
        : Promise.resolve([] as string[]),
      freeform
        ? Promise.resolve([])
        : repos.cardBans.listForCards(matchedIds, banFormatIds, scope.circuit),
      windowFormat === undefined && !hasAllowedSets
        ? Promise.resolve(new Map<string, string[]>())
        : repos.catalog.numberedSetSlugsByCardIds(matchedIds),
      windowFormat === undefined ? Promise.resolve([]) : repos.formatSets.listAll(),
    ]);
  const windows = windowRows.map((row) => toFormatSetWindow(row));

  const violations: DeckViolation[] = [];

  const banned = cardIdsBannedIn(banRows, banFormatId, scope);
  const flaggedBanned = new Set<string>();
  for (const card of cards) {
    if (!card.resolvedCardId || card.matchStatus !== "matched") {
      continue;
    }
    if (flaggedBanned.has(card.resolvedCardId)) {
      continue;
    }
    if (!banned.has(card.resolvedCardId)) {
      continue;
    }
    flaggedBanned.add(card.resolvedCardId);
    violations.push({
      zone: "deck",
      code: "banned-card",
      message:
        event.playMode === "2v2" ? `${card.rawName} is banned in 2v2` : `${card.rawName} is banned`,
      cardId: card.resolvedCardId,
    });
  }

  const deckCards = cards.flatMap((card) => {
    const detail = card.resolvedCardId ? details.get(card.resolvedCardId) : undefined;
    if (!detail) {
      return [];
    }
    return [
      {
        cardId: detail.id,
        zone: card.zone as DeckZone,
        quantity: card.quantity,
        cardName: detail.name,
        cardType: primaryCardType(detail.types as CardType[]),
        cardTypes: detail.types as CardType[],
        superTypes: detail.superTypes as SuperType[],
        domains: detail.domains as Domain[],
        tags: detail.tags,
        customTagSlugs: [],
        keywords: detail.keywords,
        maxCopiesOverride: detail.maxCopiesOverride,
        additionalLegendCount: detail.additionalLegendCount,
        // Always false: the banned-card violation is emitted above already,
        // and CARD_BANNED from the rule engine would double it.
        banned: false,
        ...(windowFormat === undefined
          ? {}
          : {
              setLegality: cardSetLegality(
                numberedSets.get(detail.id) ?? [],
                windows,
                windowFormat,
                scope,
              ),
            }),
      },
    ];
  });
  violations.push(
    ...validateDeck({
      format: event.format,
      cards: deckCards,
      championIdentifierTags: new Set(championIdentifierTags),
    }).filter((violation) => !REGION_CONFIG_CODES.has(violation.code)),
  );

  if (event.allowedSets && event.allowedSets.length > 0) {
    const allowed = new Set(event.allowedSets.map((setId) => setId.toLowerCase()));
    for (const card of cards) {
      if (!card.resolvedCardId || card.matchStatus !== "matched") {
        continue;
      }
      const cardSets = numberedSets.get(card.resolvedCardId) ?? [];
      if (!cardSets.some((setId) => allowed.has(setId.toLowerCase()))) {
        violations.push({
          zone: "deck",
          code: "out-of-allowed-sets",
          message: `${card.rawName} is not from an allowed set`,
          cardId: card.resolvedCardId,
        });
      }
    }
  }

  const excludedTypes = new Set<string>([
    WellKnown.cardType.LEGEND,
    WellKnown.cardType.RUNE,
    WellKnown.cardType.BATTLEFIELD,
  ]);
  const countedZones = new Set<string>([WellKnown.deckZone.MAIN, WellKnown.deckZone.CHAMPION]);

  const typeCountMap = new Map<string, number>();
  const domainCountMap = new Map<string, number>();
  for (const card of cards) {
    const detail = card.resolvedCardId ? details.get(card.resolvedCardId) : undefined;
    if (!detail || !countedZones.has(card.zone)) {
      continue;
    }
    const [primaryType] = detail.types;
    if (primaryType !== undefined && !excludedTypes.has(primaryType)) {
      typeCountMap.set(primaryType, (typeCountMap.get(primaryType) ?? 0) + card.quantity);
    }
    for (const domain of detail.domains) {
      domainCountMap.set(domain, (domainCountMap.get(domain) ?? 0) + card.quantity);
    }
  }

  return {
    violations,
    typeCounts: enumRows.cardTypes
      .map((row) => row.slug)
      .filter((type) => typeCountMap.has(type))
      .map((type) => ({ cardType: type as CardType, count: typeCountMap.get(type) ?? 0 })),
    domainDistribution: enumRows.domains
      .map((row) => row.slug)
      .filter((domain) => domainCountMap.has(domain))
      .map((domain) => ({ domain: domain as Domain, count: domainCountMap.get(domain) ?? 0 })),
    zoneSuggestions: computeZoneSuggestions(cards, details),
  };
}
