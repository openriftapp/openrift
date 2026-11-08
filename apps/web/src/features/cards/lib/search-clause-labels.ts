import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { resolveSearchQuery } from "@openrift/shared/search-query/bind";
import { searchTermSpan } from "@openrift/shared/search-query/edit";
import type { SearchKeyId, SearchOperator } from "@openrift/shared/search-query/keys";
import { FOREIGN_KEY_HINTS, searchKey } from "@openrift/shared/search-query/keys";
import type {
  QueryNode,
  SearchClause,
  SearchDiagnostic,
  SearchSpan,
} from "@openrift/shared/search-query/parse";
import { parseSearchQuery, pruneIgnored } from "@openrift/shared/search-query/parse";

import { m } from "@/paraglide/messages.js";

export function searchKeyLabel(key: SearchKeyId): string {
  switch (key) {
    case "type": {
      return m.search_key_type();
    }
    case "oracle": {
      return m.search_key_oracle();
    }
    case "keyword": {
      return m.search_key_keyword();
    }
    case "domain": {
      return m.search_key_domain();
    }
    case "energy": {
      return m.search_key_energy();
    }
    case "might": {
      return m.search_key_might();
    }
    case "power": {
      return m.search_key_power();
    }
    case "rarity": {
      return m.search_key_rarity();
    }
    case "set": {
      return m.search_key_set();
    }
    case "number": {
      return m.search_key_number();
    }
    case "artist": {
      return m.search_key_artist();
    }
    case "flavor": {
      return m.search_key_flavor();
    }
    case "lang": {
      return m.search_key_lang();
    }
    case "format": {
      return m.search_key_format();
    }
    case "banned": {
      return m.search_key_banned();
    }
    case "usd": {
      return m.search_key_usd();
    }
    case "eur": {
      return m.search_key_eur();
    }
    case "usdfoil": {
      return m.search_key_usdfoil();
    }
    case "eurfoil": {
      return m.search_key_eurfoil();
    }
    case "price": {
      return m.search_key_price();
    }
    case "is": {
      return m.search_key_is();
    }
    case "not": {
      return m.search_key_not();
    }
    case "has": {
      return m.search_key_has();
    }
    case "tag": {
      return m.search_key_tag();
    }
    case "marker": {
      return m.search_key_marker();
    }
    case "channel": {
      return m.search_key_channel();
    }
    case "ctag": {
      return m.search_key_ctag();
    }
    case "owned": {
      return m.search_key_owned();
    }
    case "year": {
      return m.search_key_year();
    }
    case "date": {
      return m.search_key_date();
    }
    case "order": {
      return m.search_key_order();
    }
    case "direction": {
      return m.search_key_direction();
    }
    case "unique": {
      return m.search_key_unique();
    }
    case "in": {
      return m.search_key_in();
    }
    case "prefer": {
      return m.search_key_prefer();
    }
  }
}

const OPERATOR_SYMBOLS: Record<SearchOperator, string> = {
  ":": "=",
  "=": "=",
  "!=": "≠",
  "<": "<",
  "<=": "≤",
  ">": ">",
  ">=": "≥",
};

export type SearchValueLabeler = (key: SearchKeyId, value: string) => string;

function describeClause(clause: SearchClause, valueLabel: SearchValueLabeler): string {
  const definition = searchKey(clause.key);
  const key = searchKeyLabel(clause.key);
  const value = valueLabel(clause.key, clause.value);
  let text: string;
  const comparison = clause.operator !== ":" && clause.operator !== "=" && clause.operator !== "!=";
  switch (comparison ? "compare" : definition.kind) {
    case "text":
    case "code": {
      text =
        clause.operator === "="
          ? m.search_clause_equals({ key, value })
          : clause.operator === "!="
            ? m.search_clause_not_contains({ key, value })
            : m.search_clause_contains({ key, value });
      break;
    }
    case "flag": {
      text = m.search_clause_flag({ key, value });
      break;
    }
    case "enum":
    case "set":
    case "directive": {
      text =
        clause.operator === "!="
          ? m.search_clause_enum_not({ key, value })
          : m.search_clause_enum({ key, value });
      break;
    }
    default: {
      text = m.search_clause_compare({ key, operator: OPERATOR_SYMBOLS[clause.operator], value });
    }
  }
  return clause.negated ? m.search_clause_negated({ clause: text }) : text;
}

function describeNode(node: QueryNode, valueLabel: SearchValueLabeler, nested: boolean): string {
  switch (node.kind) {
    case "clause": {
      return describeClause({ ...node, negated: false }, valueLabel);
    }
    case "exact": {
      return m.search_clause_exact({ value: node.value });
    }
    case "text": {
      return m.search_clause_word({ value: node.value });
    }
    case "invalid":
    case "ignored": {
      return m.search_clause_word({ value: "…" });
    }
    case "not": {
      return m.search_clause_negated({ clause: describeNode(node.child, valueLabel, true) });
    }
    case "and":
    case "or": {
      const join = node.kind === "and" ? m.search_clause_and : m.search_clause_or;
      const text = node.children
        .map((child) => describeNode(child, valueLabel, true))
        .reduce((left, right) => join({ left, right }));
      return nested ? `(${text})` : text;
    }
  }
}

function hasKeyedTerm(node: QueryNode): boolean {
  switch (node.kind) {
    case "clause":
    case "exact": {
      return true;
    }
    case "not": {
      return hasKeyedTerm(node.child);
    }
    case "and":
    case "or": {
      return node.children.some((child) => hasKeyedTerm(child));
    }
    default: {
      return false;
    }
  }
}

export interface SearchTermChip {
  id: string;
  text: string;
  span: SearchSpan;
  tone: "term" | "warning" | "error";
}

export function describeSearchTerms(
  query: string,
  vocabulary: SearchVocabulary,
  valueLabel: SearchValueLabeler,
  shownByFilters: readonly SearchSpan[] = [],
): SearchTermChip[] {
  const resolved = resolveSearchQuery(parseSearchQuery(query), vocabulary);
  const root = resolved.root;
  const topLevel = root ? (root.kind === "and" ? root.children : [root]) : [];
  const nodes = topLevel.flatMap((node) => pruneIgnored(node) ?? []);
  const terms = nodes.flatMap((node): SearchTermChip[] => {
    if (!hasKeyedTerm(node)) {
      return [];
    }
    const span = searchTermSpan(node, resolved.terms);
    if (shownByFilters.some((shown) => shown.start === span.start)) {
      return [];
    }
    return [
      { id: `term-${span.start}`, text: describeNode(node, valueLabel, false), span, tone: "term" },
    ];
  });
  const directives = resolved.clauses
    .filter((clause) => searchKey(clause.key).kind === "directive")
    .map((clause): SearchTermChip => ({
      id: `directive-${clause.span.start}`,
      text: describeClause(clause, valueLabel),
      span: clause.span,
      tone: "term",
    }));
  const problems = resolved.diagnostics.flatMap((diagnostic): SearchTermChip[] => {
    const text = describeDiagnostic(diagnostic);
    return text === null
      ? []
      : [
          {
            id: `${diagnostic.code}-${diagnostic.span.start}`,
            text,
            span: diagnostic.span,
            tone: diagnostic.severity,
          },
        ];
  });
  return [...terms, ...directives, ...problems].toSorted((a, b) => a.span.start - b.span.start);
}

export function describeDiagnostic(diagnostic: SearchDiagnostic): string | null {
  const typed = `${diagnostic.key ?? ""}:`;
  const value = diagnostic.value ?? "";
  switch (diagnostic.code) {
    case "unknownKey": {
      const hint = FOREIGN_KEY_HINTS[(diagnostic.key ?? "").toLowerCase()];
      return hint
        ? m.search_diagnostic_unknown_key_hint({ key: typed, hint: `${hint}:` })
        : m.search_diagnostic_unknown_key({ key: typed });
    }
    case "ambiguousValue": {
      return m.search_diagnostic_ambiguous_value({
        key: searchKeyLabel(diagnostic.key as SearchKeyId),
        value,
      });
    }
    case "badValue": {
      return m.search_diagnostic_bad_value({ key: typed, value });
    }
    case "badOperator": {
      return m.search_diagnostic_bad_operator({ key: typed });
    }
    case "unknownValue": {
      return m.search_diagnostic_unknown_value({
        key: searchKeyLabel(diagnostic.key as SearchKeyId),
        value,
      });
    }
    case "unbalancedParen": {
      return m.search_diagnostic_unbalanced_paren();
    }
    case "emptyGroup": {
      return m.search_diagnostic_empty_group();
    }
    case "danglingOr": {
      return m.search_diagnostic_dangling_or();
    }
    case "unsupportedKey": {
      return m.search_diagnostic_unsupported_key({ key: typed });
    }
    case "emptyValue": {
      return null;
    }
  }
}
