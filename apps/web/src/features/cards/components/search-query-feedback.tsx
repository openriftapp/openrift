import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { resolveSearchQuery } from "@openrift/shared/search-query/bind";
import { searchKey } from "@openrift/shared/search-query/keys";
import { parseSearchQuery } from "@openrift/shared/search-query/parse";

import { Badge } from "@/components/ui/badge";
import type { SearchValueLabeler } from "@/features/cards/lib/search-clause-labels";
import {
  describeClause,
  describeDiagnostic,
  describeQueryChips,
} from "@/features/cards/lib/search-clause-labels";
import { m } from "@/paraglide/messages.js";

interface SearchQueryFeedbackProps {
  query: string;
  vocabulary: SearchVocabulary;
  valueLabel: SearchValueLabeler;
}

export function SearchQueryFeedback({ query, vocabulary, valueLabel }: SearchQueryFeedbackProps) {
  const resolved = resolveSearchQuery(parseSearchQuery(query), vocabulary);
  const directives = resolved.clauses
    .filter((clause) => searchKey(clause.key).kind === "directive")
    .map((clause) => ({
      id: `directive-${clause.span.start}`,
      text: describeClause(clause, valueLabel),
    }));
  const problems = resolved.diagnostics.flatMap((diagnostic) => {
    const text = describeDiagnostic(diagnostic);
    return text === null
      ? []
      : [{ id: `${diagnostic.code}-${diagnostic.span.start}`, text, tone: diagnostic.severity }];
  });
  const chips = [...describeQueryChips(resolved.root, valueLabel), ...directives];

  if (chips.length === 0 && problems.length === 0) {
    return null;
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {chips.length > 0 && (
        <ul aria-label={m.search_query_label()} className="contents">
          {chips.map((chip) => (
            <li key={chip.id}>
              <Badge variant="neutral" className="font-normal">
                {chip.text}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {problems.map((problem) => (
        <Badge
          key={problem.id}
          variant={problem.tone === "error" ? "destructive" : "warning"}
          className="font-normal"
        >
          {problem.text}
        </Badge>
      ))}
    </div>
  );
}
