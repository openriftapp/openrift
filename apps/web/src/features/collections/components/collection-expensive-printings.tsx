import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { RowList, RowListItem, RowListLink } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import type { PricedCard } from "@/features/collections/hooks/use-collection-stats";

const COLLAPSED_EXPENSIVE_PRINTINGS = 2;

export function MostExpensivePrintings({
  printings,
  formatPrice,
}: {
  printings: PricedCard[];
  formatPrice: (value?: number | null) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (printings.length === 0) {
    return null;
  }

  const visible = expanded ? printings : printings.slice(0, COLLAPSED_EXPENSIVE_PRINTINGS);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading as="h3">Most Expensive Printings</SectionHeading>
      <RowList>
        {visible.map((printing, index) => (
          <RowListItem key={printing.printingId}>
            <RowListLink
              render={
                <Link
                  to="/cards/$cardSlug/{-$printingSlug}"
                  params={{ cardSlug: printing.cardSlug }}
                />
              }
            >
              <span className="text-muted-foreground w-5 shrink-0 text-right tabular-nums">
                {index + 1}
              </span>
              {printing.thumbnail && (
                <HoverCard>
                  {/* Base UI's default trigger is an anchor, which can't nest
                      inside the row's own link. */}
                  <HoverCardTrigger render={<span />}>
                    <CardArtThumb src={printing.thumbnail} className="h-20" />
                  </HoverCardTrigger>
                  {printing.fullImage && (
                    <HoverCardContent side="right" className="w-auto p-1">
                      <img src={printing.fullImage} alt="" className="h-80 w-auto rounded-md" />
                    </HoverCardContent>
                  )}
                </HoverCard>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{printing.name}</span>
              <span className="shrink-0 text-sm tabular-nums">{formatPrice(printing.price)}</span>
            </RowListLink>
          </RowListItem>
        ))}
      </RowList>
      {printings.length > COLLAPSED_EXPENSIVE_PRINTINGS && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          {expanded ? "Show less" : `Show more (${printings.length})`}
        </Button>
      )}
    </section>
  );
}
