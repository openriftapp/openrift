import { legendDisplayName } from "@openrift/shared/card-name";
import { cardHiddenCodesOf, cardPrintedNamesOf } from "@openrift/shared/filters";
import { uniquePrintings } from "@openrift/shared/printing-side";
import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { resolveSearchQuery } from "@openrift/shared/search-query/bind";
import type { SearchContext } from "@openrift/shared/search-query/evaluate";
import { compileQuery } from "@openrift/shared/search-query/evaluate";
import type { SearchKeyId } from "@openrift/shared/search-query/keys";
import type { QueryNode } from "@openrift/shared/search-query/parse";
import { parseSearchQuery } from "@openrift/shared/search-query/parse";
import type { Printing } from "@openrift/shared/types/catalog";

import { describeDiagnostic } from "@/features/cards/lib/search-clause-labels";
import type { QuickAddCardResult } from "@/features/collections/lib/quick-add-result";

const UNSUPPORTED_KEYS: readonly SearchKeyId[] = ["owned", "ctag"];

export interface QuickSyntaxSearchResult {
  results: QuickAddCardResult[];
  total: number;
  problems: string[];
}

interface QuickSyntaxSearchOptions {
  vocabulary?: SearchVocabulary;
  context?: SearchContext;
  preferredLanguages?: readonly string[];
  ownedCountByPrinting?: Record<string, number>;
  limit: number;
}

function usesSyntax(node: QueryNode): boolean {
  switch (node.kind) {
    case "text": {
      return false;
    }
    case "and": {
      return node.children.some((child) => usesSyntax(child));
    }
    default: {
      return true;
    }
  }
}

export function isSyntaxQuery(query: string): boolean {
  const { root } = parseSearchQuery(query);
  return root === null ? query.trim() !== "" : usesSyntax(root);
}

function hasLanguageClause(node: QueryNode | null): boolean {
  if (!node) {
    return false;
  }
  switch (node.kind) {
    case "clause": {
      return node.key === "lang";
    }
    case "not": {
      return hasLanguageClause(node.child);
    }
    case "and":
    case "or": {
      return node.children.some((child) => hasLanguageClause(child));
    }
    default: {
      return false;
    }
  }
}

export function quickSyntaxSearch(
  query: string,
  printingsByCardId: ReadonlyMap<string, readonly Printing[]>,
  options: QuickSyntaxSearchOptions,
): QuickSyntaxSearchResult {
  const {
    vocabulary = {},
    context = {},
    preferredLanguages,
    ownedCountByPrinting,
    limit,
  } = options;
  const parsed = parseSearchQuery(query);
  const resolved = resolveSearchQuery(parsed, vocabulary, UNSUPPORTED_KEYS);
  const matches = compileQuery(resolved.root);
  const allowlist =
    preferredLanguages && preferredLanguages.length > 0 && !hasLanguageClause(parsed.root)
      ? new Set(preferredLanguages)
      : null;

  const isShown = (printing: Printing) => allowlist === null || allowlist.has(printing.language);
  const searchable = [...printingsByCardId.values()].flat();
  const searchContext = {
    ...context,
    cardPrintedNames: context.cardPrintedNames ?? cardPrintedNamesOf(searchable),
    cardHiddenCodes: allowlist === null ? undefined : cardHiddenCodesOf(searchable, isShown),
  };

  const rows: QuickAddCardResult[] = [];
  for (const [cardId, printings] of printingsByCardId) {
    const matching = printings.filter(
      (printing) => isShown(printing) && matches(printing, searchContext),
    );
    const first = matching[0];
    if (!first) {
      continue;
    }
    let ownedCount = 0;
    if (ownedCountByPrinting) {
      for (const printing of uniquePrintings(matching)) {
        ownedCount += ownedCountByPrinting[printing.printingId] ?? 0;
      }
    }
    rows.push({
      cardId,
      cardName: legendDisplayName(first.card),
      defaultPrinting: first,
      printings: matching,
      ownedCount,
    });
  }

  return {
    results: rows.toSorted((a, b) => a.cardName.localeCompare(b.cardName)).slice(0, limit),
    total: rows.length,
    problems: resolved.diagnostics.flatMap((diagnostic) => describeDiagnostic(diagnostic) ?? []),
  };
}
