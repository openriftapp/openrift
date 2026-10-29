import { printingFieldEquals, printingMatchesField, toSearchTerm } from "../filters-search.js";
import type { SearchTerm } from "../filters-search.js";
import { isStandardPrinting } from "../standard.js";
import type { PriceLookup } from "../types/api/pricing.js";
import type { Printing } from "../types/catalog.js";
import type { SearchField } from "../types/search.js";
import { WellKnown } from "../well-known.js";
import type { SearchVocabulary } from "./bind.js";
import { resolveSearchQuery } from "./bind.js";
import type { IsValue, PreferValue, SearchKeyId, SearchOperator } from "./keys.js";
import { formatSearchSlug, looksLikeCardNumber, searchKey } from "./keys.js";
import type { QueryNode } from "./parse.js";
import { parseSearchQuery, pruneIgnored } from "./parse.js";

export interface SearchContext {
  keywordReverseMap?: Map<string, string>;
  /** Major currency units. */
  getPrice?: (printing: Printing) => number | undefined;
  /** Major currency units. */
  priceLookup?: PriceLookup;
  customTagAssignments?: Record<string, readonly string[]>;
  getOwnedCount?: (printing: Printing) => number | undefined;
  rarityOrder?: readonly string[];
  vocabulary?: SearchVocabulary;
  strict?: boolean;
}

type SearchPredicate = (printing: Printing, context: SearchContext) => boolean;

const MATCH_ALL: SearchPredicate = () => true;
const MATCH_NONE: SearchPredicate = () => false;

const DEFAULT_RARITY_ORDER: readonly string[] = Object.values(WellKnown.rarity);

const NON_DECK_TYPES: readonly string[] = [WellKnown.cardType.OTHER];

function compareNumbers(actual: number, operator: SearchOperator, expected: number): boolean {
  switch (operator) {
    case ":":
    case "=": {
      return actual === expected;
    }
    case "!=": {
      return actual !== expected;
    }
    case "<": {
      return actual < expected;
    }
    case "<=": {
      return actual <= expected;
    }
    case ">": {
      return actual > expected;
    }
    case ">=": {
      return actual >= expected;
    }
  }
}

function numberPredicate(
  read: (printing: Printing, context: SearchContext) => number | null | undefined,
  operator: SearchOperator,
  expected: number,
): SearchPredicate {
  return (printing, context) => {
    const actual = read(printing, context);
    return actual !== null && actual !== undefined && compareNumbers(actual, operator, expected);
  };
}

/** A partial date covers a range: `2025` is the whole year, `2025-08` the whole month. */
function dateBounds(value: string): { low: string; high: string } {
  if (value.length === 4) {
    return { low: `${value}-01-01`, high: `${value}-12-31` };
  }
  if (value.length === 7) {
    return { low: `${value}-01`, high: `${value}-31` };
  }
  return { low: value, high: value };
}

function datePredicate(operator: SearchOperator, value: string): SearchPredicate {
  const { low, high } = dateBounds(value);
  return (printing) => {
    const date = printing.setReleasedAt;
    if (!date) {
      return false;
    }
    switch (operator) {
      case ":":
      case "=": {
        return date >= low && date <= high;
      }
      case "!=": {
        return date < low || date > high;
      }
      case "<": {
        return date < low;
      }
      case "<=": {
        return date <= high;
      }
      case ">": {
        return date > high;
      }
      case ">=": {
        return date >= low;
      }
    }
  };
}

function slugListPredicate(
  read: (printing: Printing, context: SearchContext) => readonly string[],
  operator: SearchOperator,
  value: string,
): SearchPredicate {
  const has = (printing: Printing, context: SearchContext) =>
    read(printing, context).some((slug) => slug.toLowerCase() === value);
  return operator === "!=" ? (printing, context) => !has(printing, context) : has;
}

/** Colorless cards fit any domain list, as colorless cards fit any color identity. */
function domainPredicate(operator: SearchOperator, value: string): SearchPredicate {
  const wanted = value.split(",");
  return (printing) => {
    const domains = printing.card.domains.map((domain) => domain.toLowerCase());
    const hasAll = wanted.every((domain) => domains.includes(domain));
    const within = domains.every(
      (domain) => wanted.includes(domain) || domain === WellKnown.domain.COLORLESS,
    );
    const same = hasAll && domains.length === wanted.length;
    switch (operator) {
      case ":":
      case ">=": {
        return hasAll;
      }
      case "=": {
        return same;
      }
      case "!=": {
        return !same;
      }
      case ">": {
        return hasAll && domains.length > wanted.length;
      }
      case "<=": {
        return within;
      }
      case "<": {
        return within && !same;
      }
    }
  };
}

function cardNumberPart(printing: Printing): number | null {
  const match = /(?<digits>\d+)\D*$/u.exec(printing.shortCode);
  return match?.groups?.digits === undefined ? null : Number(match.groups.digits);
}

function collectorNumbers(printing: Printing): { full: string; base: string } {
  const code = printing.shortCode.toLowerCase();
  const dash = code.indexOf("-");
  const full = dash === -1 ? code : code.slice(dash + 1);
  return { full, base: full.replace(/(?<=\d)[a-z*]+$/u, "") };
}

function collectorNumberMatches(printing: Printing, value: string): boolean {
  const wanted = value.toLowerCase().replaceAll(/[^a-z0-9*]/gu, "");
  const { full, base } = collectorNumbers(printing);
  if (/^\d+$/u.test(wanted)) {
    return /^\d+$/u.test(base) && Number(base) === Number(wanted);
  }
  if (wanted === full || wanted === base) {
    return true;
  }
  const squashed = printing.shortCode.toLowerCase().replaceAll(/[^a-z0-9*]/gu, "");
  const prefix = squashed.slice(0, squashed.length - full.length);
  return wanted === squashed || wanted === prefix + base;
}

function rarityPredicate(operator: SearchOperator, value: string): SearchPredicate {
  if (operator === ":" || operator === "=" || operator === "!=") {
    return slugListPredicate((printing) => [printing.rarity], operator, value);
  }
  return (printing, context) => {
    const order = (context.rarityOrder ?? DEFAULT_RARITY_ORDER).map((slug) => slug.toLowerCase());
    const expected = order.indexOf(value);
    const actual = order.indexOf(printing.rarity.toLowerCase());
    return expected !== -1 && actual !== -1 && compareNumbers(actual, operator, expected);
  };
}

function textPredicate(
  field: SearchField,
  operator: SearchOperator,
  term: SearchTerm,
): SearchPredicate {
  if (operator === "=") {
    return (printing) => printingFieldEquals(printing, field, term);
  }
  const contains: SearchPredicate = (printing, context) =>
    printingMatchesField(printing, field, term, context.keywordReverseMap);
  return operator === "!=" ? (printing, context) => !contains(printing, context) : contains;
}

function isPredicate(value: IsValue): SearchPredicate {
  switch (value) {
    case "foil": {
      return (printing) => printing.finish === WellKnown.finish.FOIL;
    }
    case "metal": {
      return (printing) => printing.finish === WellKnown.finish.METAL;
    }
    case "metaldeluxe": {
      return (printing) => printing.finish === WellKnown.finish.METAL_DELUXE;
    }
    case "altart": {
      return (printing) => printing.artVariant === WellKnown.artVariant.ALTART;
    }
    case "ultimate": {
      return (printing) => printing.artVariant === WellKnown.artVariant.ULTIMATE;
    }
    case "signed": {
      return (printing) => printing.isSigned;
    }
    case "overnumbered": {
      return (printing) => printing.isOvernumbered;
    }
    case "oversized": {
      return (printing) => printing.size === WellKnown.cardSize.OVERSIZED;
    }
    case "plain": {
      return (printing) => isStandardPrinting(printing);
    }
    case "promo": {
      return (printing) => printing.markers.length > 0;
    }
    case "reprint": {
      return (printing) => printing.isReprint === true;
    }
    case "firstprint": {
      return (printing) => printing.isReprint !== true;
    }
    case "nonfoil": {
      return (printing) => printing.finish === WellKnown.finish.NORMAL;
    }
    case "variant": {
      return (printing) => !isStandardPrinting(printing);
    }
  }
}

function hasPredicate(value: string): SearchPredicate {
  switch (value) {
    case "errata": {
      return (printing) => printing.card.errata !== null;
    }
    case "image": {
      return (printing) => printing.images.length > 0;
    }
    case "marker": {
      return (printing) => printing.markers.length > 0;
    }
    case "keyword": {
      return (printing) => printing.card.keywords.length > 0;
    }
    default: {
      return (printing) => printing.card.tags.length > 0;
    }
  }
}

const TWO_V_TWO = WellKnown.banFormat.TWO_V_TWO.toLowerCase();

/** 2v2 records only its own extra bans; everything banned in Constructed is banned there too. */
function isBannedIn(printing: Printing, format: string): boolean {
  return printing.card.bans.some(
    (ban) =>
      ban.formatId.toLowerCase() === format ||
      formatSearchSlug(ban.formatName) === format ||
      (format === TWO_V_TWO && ban.formatId === WellKnown.banFormat.CONSTRUCTED),
  );
}

/** Tokens and the "other" type (buffs, trackers) are game objects, never deck cards. */
function isDeckable(printing: Printing): boolean {
  const { card } = printing;
  return (
    !card.superTypes.includes(WellKnown.superType.TOKEN) &&
    !card.types.some((type) => NON_DECK_TYPES.includes(type))
  );
}

function typePredicate(operator: SearchOperator, value: string): SearchPredicate {
  const term = toSearchTerm(value);
  if (!term) {
    return MATCH_ALL;
  }
  const positive = operator === "!=" ? ":" : operator;
  const types = textPredicate("type", positive, term);
  const tags = textPredicate("tags", positive, term);
  const either: SearchPredicate = (printing, context) =>
    types(printing, context) || tags(printing, context);
  return operator === "!=" ? (printing, context) => !either(printing, context) : either;
}

function clausePredicate(
  key: SearchKeyId,
  operator: SearchOperator,
  value: string,
): SearchPredicate {
  const definition = searchKey(key);
  if (definition.kind === "code") {
    if (operator === "!=") {
      return (printing) => !collectorNumberMatches(printing, value);
    }
    if (operator === ":" || operator === "=") {
      return (printing) => collectorNumberMatches(printing, value);
    }
    return numberPredicate((printing) => cardNumberPart(printing), operator, Number(value));
  }
  if (key === "type") {
    return typePredicate(operator, value);
  }
  if (definition.kind === "text" && definition.field) {
    const term = toSearchTerm(value);
    return term ? textPredicate(definition.field, operator, term) : MATCH_ALL;
  }
  const number = Number(value);
  switch (key) {
    case "domain": {
      return domainPredicate(operator, value);
    }
    case "rarity": {
      return rarityPredicate(operator, value);
    }
    case "set": {
      return slugListPredicate((printing) => [printing.setSlug], operator, value);
    }
    case "lang": {
      return value === "any"
        ? MATCH_ALL
        : slugListPredicate((printing) => [printing.language], operator, value);
    }
    case "in": {
      return slugListPredicate(
        (printing) => [
          ...(printing.cardSetSlugs ?? [printing.setSlug]),
          ...(printing.cardLanguages ?? [printing.language]),
        ],
        operator,
        value,
      );
    }
    case "marker": {
      return slugListPredicate(
        (printing) => printing.markers.map((marker) => marker.slug),
        operator,
        value,
      );
    }
    case "channel": {
      return slugListPredicate(
        (printing) => printing.distributionChannels.map((entry) => entry.channel.slug),
        operator,
        value,
      );
    }
    case "ctag": {
      return slugListPredicate(
        (printing, context) => context.customTagAssignments?.[printing.cardId] ?? [],
        operator,
        value,
      );
    }
    // A card without a cost costs 0, as a land's mana value is 0. Might stays absent.
    case "energy": {
      return numberPredicate((printing) => printing.card.energy ?? 0, operator, number);
    }
    case "might": {
      return numberPredicate((printing) => printing.card.might, operator, number);
    }
    case "power": {
      return numberPredicate((printing) => printing.card.power ?? 0, operator, number);
    }
    case "usd": {
      return numberPredicate(
        (printing, context) => context.priceLookup?.get(printing.printingId, "tcgplayer"),
        operator,
        number,
      );
    }
    case "eur": {
      return numberPredicate(
        (printing, context) => context.priceLookup?.get(printing.printingId, "cardmarket"),
        operator,
        number,
      );
    }
    case "usdfoil":
    case "eurfoil": {
      const marketplace = key === "usdfoil" ? "tcgplayer" : "cardmarket";
      return numberPredicate(
        (printing, context) =>
          printing.finish === WellKnown.finish.FOIL
            ? context.priceLookup?.get(printing.printingId, marketplace)
            : undefined,
        operator,
        number,
      );
    }
    case "price": {
      return numberPredicate((printing, context) => context.getPrice?.(printing), operator, number);
    }
    case "owned": {
      return numberPredicate(
        (printing, context) => context.getOwnedCount?.(printing),
        operator,
        number,
      );
    }
    case "year": {
      return numberPredicate((printing) => printing.printedYear, operator, number);
    }
    case "date": {
      return datePredicate(operator, value);
    }
    case "format": {
      return (printing) => isDeckable(printing) && !isBannedIn(printing, value);
    }
    case "banned": {
      return (printing) => isBannedIn(printing, value);
    }
    case "is": {
      return isPredicate(value as IsValue);
    }
    case "not": {
      const is = isPredicate(value as IsValue);
      return (printing, context) => !is(printing, context);
    }
    case "has": {
      return hasPredicate(value);
    }
    default: {
      return MATCH_ALL;
    }
  }
}

function exactNamePredicate(value: string): SearchPredicate {
  const term = toSearchTerm(value);
  return term ? (printing) => printingFieldEquals(printing, "name", term) : MATCH_ALL;
}

function textTermPredicate(value: string): SearchPredicate {
  const term = toSearchTerm(value);
  if (!term) {
    return MATCH_ALL;
  }
  if (looksLikeCardNumber(value)) {
    return (printing) =>
      printingMatchesField(printing, "name", term) || printingMatchesField(printing, "id", term);
  }
  return (printing) => printingMatchesField(printing, "name", term);
}

export function compileQuery(root: QueryNode | null, strict = false): SearchPredicate {
  return compileNode(strict ? root : pruneIgnored(root));
}

function compileNode(node: QueryNode | null): SearchPredicate {
  if (!node) {
    return MATCH_ALL;
  }
  switch (node.kind) {
    case "and": {
      const children = node.children.map((child) => compileNode(child));
      return (printing, context) => children.every((child) => child(printing, context));
    }
    case "or": {
      const children = node.children.map((child) => compileNode(child));
      return (printing, context) => children.some((child) => child(printing, context));
    }
    case "not": {
      const child = compileNode(node.child);
      return (printing, context) => !child(printing, context);
    }
    case "text": {
      return textTermPredicate(node.value);
    }
    case "exact": {
      return exactNamePredicate(node.value);
    }
    case "clause": {
      return clausePredicate(node.key, node.operator, node.value);
    }
    case "invalid":
    case "ignored": {
      return MATCH_NONE;
    }
  }
}

const COMPILED = new WeakMap<SearchVocabulary, Map<string, SearchPredicate>>();
const NO_VOCABULARY: SearchVocabulary = {};
const COMPILED_LIMIT = 200;

export function searchPredicate(
  raw: string,
  vocabulary?: SearchVocabulary,
  strict = false,
): SearchPredicate {
  const vocabularyKey = vocabulary ?? NO_VOCABULARY;
  let byQuery = COMPILED.get(vocabularyKey);
  if (!byQuery) {
    byQuery = new Map();
    COMPILED.set(vocabularyKey, byQuery);
  }
  const cacheKey = `${strict ? "strict" : "lenient"}:${raw}`;
  const cached = byQuery.get(cacheKey);
  if (cached) {
    return cached;
  }
  const parsed = parseSearchQuery(raw);
  const root = vocabulary ? resolveSearchQuery(parsed, vocabulary).root : parsed.root;
  const predicate = raw.trim() === "" ? MATCH_ALL : compileQuery(root, strict);
  if (byQuery.size >= COMPILED_LIMIT) {
    byQuery.clear();
  }
  byQuery.set(cacheKey, predicate);
  return predicate;
}

function preferenceKey(
  printing: Printing,
  prefer: PreferValue,
  prices?: PriceLookup,
): number | string | undefined {
  switch (prefer) {
    case "oldest":
    case "newest": {
      return printing.setReleasedAt;
    }
    case "usd-low": {
      return prices?.get(printing.printingId, "tcgplayer");
    }
    case "eur-low": {
      return prices?.get(printing.printingId, "cardmarket");
    }
  }
}

export function sortByPreference(
  printings: readonly Printing[],
  prefer: PreferValue,
  prices?: PriceLookup,
): Printing[] {
  const direction = prefer === "newest" ? -1 : 1;
  return printings
    .map((printing, index) => ({ printing, index, key: preferenceKey(printing, prefer, prices) }))
    .toSorted((a, b) => {
      if (a.key === undefined || b.key === undefined) {
        return (a.key === undefined ? 1 : 0) - (b.key === undefined ? 1 : 0) || a.index - b.index;
      }
      const order = a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
      return order * direction || a.index - b.index;
    })
    .map((entry) => entry.printing);
}
