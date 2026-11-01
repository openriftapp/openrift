import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import { TextLink } from "@/components/ui/text-link";
import type { SearchAlternative } from "@/features/cards/lib/search-alternative";
import { m } from "@/paraglide/messages.js";

export function alternativeLabel(alternative: SearchAlternative): string {
  return alternative.kind === "tag"
    ? m.cards_search_alternative_tag({ count: alternative.count, tag: alternative.label })
    : m.cards_search_alternative_text({ count: alternative.count, words: alternative.label });
}

export function alternativeSearch(query: string) {
  return (prev: Record<string, unknown>) => ({ ...prev, q: query });
}

export function SearchAlternativeLinks({
  alternatives,
}: {
  alternatives: readonly SearchAlternative[];
}) {
  return alternatives.map((alternative) => (
    <TextLink
      key={alternative.kind}
      className="inline-flex items-center gap-1 text-sm"
      render={<Link to="." search={alternativeSearch(alternative.query)} />}
    >
      {alternativeLabel(alternative)}
      <ArrowRightIcon className="size-3.5" aria-hidden="true" />
    </TextLink>
  ));
}
