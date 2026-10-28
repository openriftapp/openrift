import { cardSearchAltNames } from "./card-name.js";
import { foldCached, foldForSearch, squashCached, squashForSearch } from "./search-fold.js";
import type { Printing } from "./types/catalog.js";
import type { SearchField } from "./types/search.js";

export interface SearchTerm {
  text: string;
  folded: string;
  squashed: string;
}

export function toSearchTerm(text: string): SearchTerm | null {
  const folded = foldForSearch(text);
  if (folded === "") {
    return null;
  }
  return { text, folded, squashed: squashForSearch(text) };
}

function foldedContains(value: string | null | undefined, term: SearchTerm): boolean {
  return value ? foldCached(value).includes(term.folded) : false;
}

/**
 * As {@link foldedContains}, but also matches with separators stripped from
 * both sides. Restricted to identifier-like fields; see {@link squashForSearch}.
 */
function looselyContains(value: string | null | undefined, term: SearchTerm): boolean {
  if (!value) {
    return false;
  }
  return foldCached(value).includes(term.folded) || squashCached(value).includes(term.squashed);
}

export function printingMatchesField(
  printing: Printing,
  field: SearchField,
  term: SearchTerm,
  keywordReverseMap?: Map<string, string>,
): boolean {
  const { card } = printing;
  if (field === "name") {
    return (
      looselyContains(card.name, term) ||
      looselyContains(printing.printedName, term) ||
      cardSearchAltNames(card).some((name) => looselyContains(name, term))
    );
  }
  if (field === "cardText") {
    return (
      foldedContains(card.errata?.correctedRulesText, term) ||
      foldedContains(card.errata?.correctedEffectText, term) ||
      foldedContains(printing.printedRulesText, term) ||
      foldedContains(printing.printedEffectText, term)
    );
  }
  if (field === "keywords") {
    if (card.keywords.some((kw) => looselyContains(kw, term))) {
      return true;
    }
    if (keywordReverseMap) {
      const canonical = keywordReverseMap.get(term.folded);
      if (canonical) {
        const foldedCanonical = foldForSearch(canonical);
        return card.keywords.some((kw) => foldCached(kw) === foldedCanonical);
      }
    }
    return false;
  }
  if (field === "tags") {
    return card.tags.some((tag) => looselyContains(tag, term));
  }
  if (field === "artist") {
    return looselyContains(printing.artist, term);
  }
  if (field === "flavorText") {
    return foldedContains(printing.flavorText, term);
  }
  if (field === "type") {
    return (
      card.types.some((t) => looselyContains(t, term)) ||
      card.superTypes.some((st) => looselyContains(st, term))
    );
  }
  return looselyContains(printing.shortCode, term) || looselyContains(printing.publicCode, term);
}

function printingFieldValues(printing: Printing, field: SearchField): (string | null)[] {
  const { card } = printing;
  switch (field) {
    case "name": {
      return [card.name, printing.printedName, ...cardSearchAltNames(card)];
    }
    case "cardText": {
      return [
        card.errata?.correctedRulesText ?? null,
        card.errata?.correctedEffectText ?? null,
        printing.printedRulesText,
        printing.printedEffectText,
      ];
    }
    case "keywords": {
      return card.keywords;
    }
    case "tags": {
      return card.tags;
    }
    case "artist": {
      return [printing.artist];
    }
    case "flavorText": {
      return [printing.flavorText];
    }
    case "type": {
      return [...card.types, ...card.superTypes];
    }
    case "id": {
      return [printing.shortCode, printing.publicCode];
    }
  }
}

export function printingFieldEquals(
  printing: Printing,
  field: SearchField,
  term: SearchTerm,
): boolean {
  return printingFieldValues(printing, field).some(
    (value) =>
      value !== null &&
      (foldCached(value) === term.folded || squashCached(value) === term.squashed),
  );
}
