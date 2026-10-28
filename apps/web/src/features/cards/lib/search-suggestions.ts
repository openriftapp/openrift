import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import type { SearchKeyDefinition, SearchKeyId } from "@openrift/shared/search-query/keys";
import {
  DIRECTION_VALUES,
  HAS_VALUES,
  IS_VALUES,
  ORDER_VALUES,
  PREFER_VALUES,
  SEARCH_KEYS,
  searchKeyByAlias,
  UNIQUE_VALUES,
} from "@openrift/shared/search-query/keys";

export interface SearchSuggestion {
  kind: "key" | "value";
  label: string;
  insert: string;
  key: SearchKeyId;
}

interface SearchSuggestions {
  start: number;
  end: number;
  suggestions: SearchSuggestion[];
}

const FIXED_VALUES: Partial<Record<SearchKeyId, readonly string[]>> = {
  is: IS_VALUES,
  not: IS_VALUES,
  has: HAS_VALUES,
  order: ORDER_VALUES,
  direction: DIRECTION_VALUES,
  unique: UNIQUE_VALUES,
  prefer: PREFER_VALUES,
};

const CLAUSE_HEAD = /^(?<alias>[a-z]+)(?<operator>!=|<=|>=|:|=|<|>)(?<partial>.*)$/iu;

function isBoundary(char: string | undefined, closing: boolean): boolean {
  return char === undefined || /\s/u.test(char) || char === (closing ? ")" : "(");
}

function quoteIfNeeded(value: string): string {
  return /\s/u.test(value) ? `"${value}"` : value;
}

function keyInsert(alias: string, definition: SearchKeyDefinition): string {
  return definition.kind === "number" || definition.kind === "date" ? alias : `${alias}:`;
}

export function searchSuggestions(
  query: string,
  caret: number,
  vocabulary: SearchVocabulary,
  limit = 8,
): SearchSuggestions | null {
  let start = caret;
  while (!isBoundary(query[start - 1], false)) {
    start -= 1;
  }
  let end = caret;
  while (!isBoundary(query[end], true)) {
    end += 1;
  }
  let token = query.slice(start, caret);
  while (token.startsWith("-")) {
    start += 1;
    token = token.slice(1);
  }
  if (token === "") {
    return null;
  }

  const head = CLAUSE_HEAD.exec(token)?.groups;
  if (head) {
    const { alias = "", operator = "", partial: partialRaw = "" } = head;
    const definition = searchKeyByAlias(alias);
    if (!definition) {
      return null;
    }
    const values = FIXED_VALUES[definition.id] ?? vocabulary[definition.id] ?? [];
    const unquoted = partialRaw.replace(/^"/u, "");
    const listed = definition.id === "domain" ? unquoted.lastIndexOf(",") + 1 : 0;
    const before = unquoted.slice(0, listed);
    const partial = unquoted.slice(listed).toLowerCase();
    const suggestions = values
      .filter((value) => {
        const lower = value.toLowerCase();
        return lower.startsWith(partial) && lower !== partial;
      })
      .slice(0, limit)
      .map((value) => ({
        kind: "value" as const,
        label: value,
        insert: `${alias}${operator}${before}${quoteIfNeeded(value)}`,
        key: definition.id,
      }));
    return suggestions.length > 0 ? { start, end, suggestions } : null;
  }

  if (!/^[a-z]+$/iu.test(token)) {
    return null;
  }
  const lower = token.toLowerCase();
  const suggestions: SearchSuggestion[] = [];
  for (const definition of SEARCH_KEYS) {
    const alias = definition.aliases.find((candidate) => candidate.startsWith(lower));
    if (alias) {
      const insert = keyInsert(alias, definition);
      suggestions.push({ kind: "key", label: insert, insert, key: definition.id });
    }
  }
  return suggestions.length > 0 ? { start, end, suggestions: suggestions.slice(0, limit) } : null;
}

export function applySuggestion(
  query: string,
  range: Pick<SearchSuggestions, "start" | "end">,
  suggestion: SearchSuggestion,
): { query: string; caret: number } {
  const after = query.slice(range.end);
  const spacer = suggestion.kind === "value" && !after.startsWith(" ") ? " " : "";
  const insert = `${suggestion.insert}${spacer}`;
  return {
    query: `${query.slice(0, range.start)}${insert}${after}`,
    caret: range.start + insert.length,
  };
}
