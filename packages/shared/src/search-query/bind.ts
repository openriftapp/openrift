import { squashForSearch } from "../search-fold.js";
import type { SearchKeyId } from "./keys.js";
import type { ParsedSearchQuery, QueryNode, SearchClause, SearchDiagnostic } from "./parse.js";

export interface SearchVocabularyValue {
  value: string;
  names?: readonly string[];
}

export type SearchVocabulary = Partial<
  Record<SearchKeyId, readonly (string | SearchVocabularyValue)[]>
>;

const PREFIX_KEYS: ReadonlySet<SearchKeyId> = new Set(["rarity", "domain"]);

const BUILT_IN_VALUES: Partial<Record<SearchKeyId, readonly string[]>> = { lang: ["any"] };

type Resolution =
  | { ok: true; value: string }
  | { ok: false; code: "unknownValue" | "ambiguousValue" };

function resolveValue(
  key: SearchKeyId,
  value: string,
  options: readonly (string | SearchVocabularyValue)[],
): Resolution {
  const entries = options.map((option) =>
    typeof option === "string" ? { value: option, names: [] } : option,
  );
  const wanted = value.toLowerCase();
  if (BUILT_IN_VALUES[key]?.includes(wanted)) {
    return { ok: true, value: wanted };
  }
  const exact = entries.find((entry) => entry.value.toLowerCase() === wanted);
  if (exact) {
    return { ok: true, value: exact.value.toLowerCase() };
  }
  const squashed = squashForSearch(value);
  const named = entries.find((entry) =>
    entry.names?.some((name) => squashForSearch(name) === squashed),
  );
  if (named) {
    return { ok: true, value: named.value.toLowerCase() };
  }
  if (PREFIX_KEYS.has(key)) {
    const matches = entries.filter((entry) => entry.value.toLowerCase().startsWith(wanted));
    if (matches.length === 1) {
      return { ok: true, value: (matches[0] as { value: string }).value.toLowerCase() };
    }
    if (matches.length > 1) {
      return { ok: false, code: "ambiguousValue" };
    }
  }
  return { ok: false, code: "unknownValue" };
}

export function resolveSearchQuery(
  parsed: ParsedSearchQuery,
  vocabulary: SearchVocabulary,
  unsupportedKeys: readonly SearchKeyId[] = [],
): ParsedSearchQuery {
  const diagnostics: SearchDiagnostic[] = [];
  const resolved = new Map<number, { value: string } | { ignored: true } | { invalid: true }>();
  for (const clause of parsed.clauses) {
    if (unsupportedKeys.includes(clause.key)) {
      diagnostics.push({
        code: "unsupportedKey",
        severity: "error",
        span: clause.span,
        key: clause.key,
        value: clause.value,
      });
      resolved.set(clause.span.start, { invalid: true });
      continue;
    }
    const known = vocabulary[clause.key];
    if (!known) {
      continue;
    }
    const parts = clause.value.split(",").map((part) => resolveValue(clause.key, part, known));
    const failed = parts.find((part) => !part.ok);
    if (failed && !failed.ok) {
      diagnostics.push({
        code: failed.code,
        severity: "warning",
        span: clause.span,
        key: clause.key,
        value: clause.value,
      });
      resolved.set(clause.span.start, { ignored: true });
      continue;
    }
    const value = parts.map((part) => (part.ok ? part.value : "")).join(",");
    resolved.set(clause.span.start, { value });
  }

  const rewrite = (node: QueryNode): QueryNode => {
    switch (node.kind) {
      case "and":
      case "or": {
        return { kind: node.kind, children: node.children.map((child) => rewrite(child)) };
      }
      case "not": {
        return { kind: "not", child: rewrite(node.child) };
      }
      case "clause": {
        const entry = resolved.get(node.span.start);
        if (!entry) {
          return node;
        }
        if ("ignored" in entry) {
          return { kind: "ignored", span: node.span };
        }
        if ("invalid" in entry) {
          return { kind: "invalid", span: node.span };
        }
        return { ...node, value: entry.value };
      }
      default: {
        return node;
      }
    }
  };

  const clauses = parsed.clauses.flatMap((clause): SearchClause[] => {
    const entry = resolved.get(clause.span.start);
    if (!entry) {
      return [clause];
    }
    return "value" in entry ? [{ ...clause, value: entry.value }] : [];
  });

  return {
    root: parsed.root ? rewrite(parsed.root) : null,
    clauses,
    directives: parsed.directives,
    diagnostics: [...parsed.diagnostics, ...diagnostics],
  };
}
