import { countNoun, pluralize } from "@openrift/shared/strings";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/empty-state";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { TextLink } from "@/components/ui/text-link";
import { AdminInstant } from "@/features/admin/components/admin-instant";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { AssignSuggestedListingsButton } from "@/features/catalog-workspace/components/batch-dialogs";
import { ListingCardPanel } from "@/features/catalog-workspace/components/listing-card-panel";
import type { ListingCard } from "@/features/catalog-workspace/lib/listings";
import { listingCardSummary, selectListingCards } from "@/features/catalog-workspace/lib/listings";
import { listingsQueryOptions } from "@/features/catalog-workspace/lib/listings-queries";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/listings");

function ListingCardRow({
  card,
  expanded,
  onToggle,
}: {
  card: ListingCard;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <ExpandToggle
        expanded={expanded}
        onClick={onToggle}
        className="hover:bg-muted/50 w-full gap-3 px-3 py-2"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="font-medium">{card.cardName}</span>
          <span className="text-muted-foreground text-sm">{listingCardSummary(card)}</span>
        </span>
        <AdminInstant
          at={card.waitingSince}
          relative
          className="text-muted-foreground shrink-0 text-sm"
        />
      </ExpandToggle>
      {expanded && <ListingCardPanel card={card} />}
    </li>
  );
}

export function ListingsPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { data } = useQuery(listingsQueryOptions());
  const query = search.q ?? "";
  const all = data?.cards ?? [];
  const noCardCount = data?.noCardCount ?? 0;
  const cards = selectListingCards(all, query);

  const toggle = (cardSlug: string) => {
    void navigate({
      replace: true,
      search: (prev) => ({ ...prev, card: prev.card === cardSlug ? undefined : cardSlug }),
    });
  };

  return (
    <>
      <AdminPageTopBar title="Listings" actions={<AssignSuggestedListingsButton />} />
      {all.length === 0 && noCardCount === 0 ? (
        <EmptyState title="No listings to map." />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <DebouncedSearchInput
              urlValue={query}
              placeholder="Search cards…"
              className="w-64"
              onCommit={(next) => {
                void navigate({
                  replace: true,
                  search: (prev) => ({ ...prev, q: next === "" ? undefined : next }),
                });
              }}
            />
            <span className="text-muted-foreground text-sm">{countNoun(all.length, "card")}</span>
          </div>
          <ul className="divide-y rounded-md border">
            {cards.map((card) => (
              <ListingCardRow
                key={card.cardSlug}
                card={card}
                expanded={search.card === card.cardSlug}
                onToggle={() => toggle(card.cardSlug)}
              />
            ))}
            {cards.length === 0 && all.length > 0 && (
              <li className="text-muted-foreground px-3 py-2">No card matches this search.</li>
            )}
            {noCardCount > 0 && (
              <li className="px-3 py-2">
                <TextLink render={<Link to="/admin/unmatched" />}>
                  {countNoun(noCardCount, "listing")} {pluralize(noCardCount, "matches", "match")}{" "}
                  no card
                </TextLink>
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}
