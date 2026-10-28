import type { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { PackageIcon } from "lucide-react";
import { useContext } from "react";

import {
  COUNT_PILL_INTERACTIVE,
  CountWithTotal,
  countPillVariants,
} from "@/components/ui/count-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SectionHeading } from "@/components/ui/section-heading";
import { OwnedVariantBreakdown } from "@/features/cards/components/owned-variant-breakdown";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { printingCollectionSearch } from "@/features/cards/lib/printing-search-link";
import {
  useOwnedCollections,
  useOwnedCollectionsByVariants,
  useOwnedCount,
} from "@/features/collections/hooks/use-owned-count";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

interface OwnedCollectionsPopoverProps {
  printingId: string;
  cardName: string;
  printing: Printing;
  count?: number;
  siblings?: readonly Printing[];
  totalCount?: number;
  otherSideName?: string;
  align?: PopoverPrimitive.Positioner.Props["align"];
  badge?: boolean;
}

export function OwnedCollectionsPopover({
  printingId,
  cardName,
  printing,
  count,
  siblings,
  totalCount,
  otherSideName,
  align = "end",
  badge,
}: OwnedCollectionsPopoverProps) {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);
  // Must stay gated: an enabled instance subscribes to the entire copies collection.
  const { data: ownedCountByPrinting } = useOwnedCount(isAuthenticated && count === undefined);
  const totalOwned = count ?? ownedCountByPrinting?.[printingId] ?? 0;
  // A scoped count of 0 still opens: the wider total means copies sit elsewhere.
  const ownsAny = totalOwned > 0 || (totalCount ?? 0) > 0;
  const groupByVariant = Boolean(siblings && siblings.length > 1);
  const { data: singleBreakdown } = useOwnedCollections(
    printingId,
    isAuthenticated && ownsAny && !groupByVariant,
  );
  const { data: variantBreakdown } = useOwnedCollectionsByVariants(
    siblings ?? [],
    isAuthenticated && ownsAny && groupByVariant,
  );
  // Optional: CardDetailOverlay renders this outside any FilterSearchProvider.
  const filterSearch = useContext(FilterSearchProvider);
  const defaultView = useDisplayStore((state) => state.defaultCardView);
  const view = filterSearch?.view ?? defaultView;
  const isPrintingsView = view === "printings" || view === "copies";

  if (!isAuthenticated || !ownsAny) {
    return null;
  }

  return (
    <Popover>
      {badge ? (
        <PopoverTrigger
          onClick={(event) => event.stopPropagation()}
          className="bg-foreground text-background ring-background text-2xs flex h-4.5 min-w-4.5 cursor-pointer items-center justify-center rounded-full px-1 font-bold tabular-nums ring-2"
        >
          ×<CountWithTotal count={totalOwned} totalCount={totalCount} />
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          onClick={(event) => event.stopPropagation()}
          className={cn(countPillVariants({ variant: "ghost" }), COUNT_PILL_INTERACTIVE)}
        >
          <PackageIcon className="size-3" />
          <CountWithTotal count={totalOwned} totalCount={totalCount} />
        </PopoverTrigger>
      )}
      <PopoverContent side="bottom" align={align} className="w-60 p-0">
        <div className="px-3 pt-2.5 pb-1">
          <SectionHeading as="h3">{m.card_detail_owned_collections_title()}</SectionHeading>
          {otherSideName && otherSideName !== cardName && !groupByVariant && (
            <p className="text-muted-foreground mt-1 text-xs">
              {m.card_detail_owned_both_sides({ name: cardName, other: otherSideName })}
            </p>
          )}
        </div>
        {groupByVariant ? (
          <OwnedVariantBreakdown variants={variantBreakdown ?? []} />
        ) : (
          <ul className="px-1 pb-1">
            {singleBreakdown?.map((entry) => (
              <li key={entry.collectionId}>
                <Link
                  to="/collections/$collectionId"
                  params={{ collectionId: entry.collectionId }}
                  search={isPrintingsView ? printingCollectionSearch(printing) : { q: cardName }}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-sm",
                    "hover:bg-muted transition-colors",
                  )}
                >
                  <span className="truncate">{entry.collectionName}</span>
                  <span className="text-muted-foreground ml-2 shrink-0 tabular-nums">
                    &times;{entry.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
