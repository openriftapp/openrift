import { buildCardLookupIndex } from "@openrift/shared/card-lookup";
import { legendDisplayName } from "@openrift/shared/card-name";
import { enumLabel, labelMap } from "@openrift/shared/enum-label";
import { sortByLanguageAndCanonicalRank } from "@openrift/shared/printing-select";
import type { InitResponse } from "@openrift/shared/types/api/init";
import type { Card, Printing } from "@openrift/shared/types/catalog";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import type { SubmitEvent } from "react";
import { useState } from "react";

import { ErrorMessageLayout } from "@/components/error-message";
import { SearchInput } from "@/components/search-input";
import { CardLink } from "@/components/ui/card-link";
import { TextLink } from "@/components/ui/text-link";
import { PrintingThumbnail } from "@/features/cards/components/printing-option-content";
import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import type { UseCardsResult } from "@/features/cards/lib/catalog-queries";
import { closestCard, slugToSearchText } from "@/features/cards/lib/closest-card";
import { useHydrated } from "@/hooks/use-hydrated";
import { initQueryOptions } from "@/lib/init-queries";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

export function CardNotFound() {
  const { cardSlug } = useParams({ strict: false });
  const slugText = slugToSearchText(cardSlug ?? "");
  const [query, setQuery] = useState(slugText);
  const navigate = useNavigate();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = query.trim();
    void navigate({ to: "/cards", search: q ? { q } : {} });
  };

  return (
    <ErrorMessageLayout heading={m.error_notfound_heading_no_card()} className="flex-1">
      <form role="search" onSubmit={submit} className="w-full max-w-md text-left">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={m.collections_import_search_cards_placeholder()}
          aria-label={m.collections_import_search_cards_aria()}
        />
      </form>
      <ClosestCardSlot query={slugText} />
      <TextLink variant="muted" className="text-sm" render={<Link to="/cards" />}>
        {m.error_notfound_card_browse_all()}
      </TextLink>
    </ErrorMessageLayout>
  );
}

// The catalog is a client-only read, so the slot keeps its height from the first paint.
function ClosestCardSlot({ query }: { query: string }) {
  const hydrated = useHydrated();
  const { data: catalog } = useQuery({ ...catalogQueryOptions, enabled: hydrated });
  const { data: init } = useQuery({ ...initQueryOptions, enabled: hydrated });
  const languages = useDisplayStore((state) => state.languages);

  const suggestion =
    hydrated && catalog !== undefined ? suggestCard(catalog, query, languages) : undefined;

  return (
    <div className="flex min-h-16 w-full max-w-md flex-col">
      {suggestion && init && (
        <ClosestCardRow card={suggestion.card} printing={suggestion.printing} init={init} />
      )}
    </div>
  );
}

function suggestCard(
  catalog: UseCardsResult,
  query: string,
  languages: readonly string[],
): { card: Card; printing: Printing } | undefined {
  const cards = Object.entries(catalog.cardsById)
    .filter(([id]) => catalog.printingsByCardId.has(id))
    .map(([id, card]) => ({
      id,
      slug: card.slug,
      name: card.name,
      types: card.types,
      tags: card.tags,
    }));
  const match = closestCard(buildCardLookupIndex(cards, catalog.allPrintings), query);
  const card = match ? catalog.cardsById[match.id] : undefined;
  const printing = match
    ? sortByLanguageAndCanonicalRank(catalog.printingsByCardId.get(match.id) ?? [], languages)[0]
    : undefined;
  return card && printing ? { card, printing } : undefined;
}

function ClosestCardRow({
  card,
  printing,
  init,
}: {
  card: Card;
  printing: Printing;
  init: InitResponse;
}) {
  const typeLabels = labelMap(init.enums.cardTypes);
  const domainLabels = labelMap(init.enums.domains);
  const details = [
    printing.shortCode,
    card.types.map((type) => enumLabel(typeLabels, type)).join(" "),
    card.domains.map((domain) => enumLabel(domainLabels, domain)).join(", "),
  ].filter((part) => part !== "");

  return (
    <CardLink
      size="sm"
      className="flex-row items-center gap-3 px-3 text-left"
      render={<Link to="/cards/$cardSlug/{-$printingSlug}" params={{ cardSlug: card.slug }} />}
    >
      <PrintingThumbnail printing={printing} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{legendDisplayName(card)}</span>
        <span className="text-muted-foreground truncate text-xs">{details.join(" · ")}</span>
      </span>
      <ChevronRightIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
    </CardLink>
  );
}
