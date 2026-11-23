import { enumLabel } from "@openrift/shared/enum-label";
import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { pairNamesByPrinting } from "@/features/admin/lib/face-rows";
import { CardListingsSection } from "@/features/catalog-workspace/components/card-listings-section";
import type { ListingCard } from "@/features/catalog-workspace/lib/listings";
import { useEnumOrders } from "@/hooks/use-enums";

export function ListingCardPanel({ card }: { card: ListingCard }) {
  const { data: detail, isPending, isError } = useAdminCardDetail(card.cardSlug);
  const { labels } = useEnumOrders();

  return (
    <div className="space-y-3 px-3 pb-3">
      <TextLink
        className="text-sm"
        render={<Link to="/admin/workspace/cards/$cardSlug" params={{ cardSlug: card.cardSlug }} />}
      >
        Open card record
      </TextLink>
      {card.variants.length > 0 && (
        <ul className="space-y-1.5">
          {card.variants.map((variant) => (
            <li
              key={`${variant.language ?? ""}|${variant.finish}`}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="min-w-0 flex-1">
                {[
                  variant.language ?? "Language not listed",
                  enumLabel(labels.finishes, variant.finish),
                ].join(" · ")}{" "}
                <span className="text-muted-foreground text-sm">
                  {variant.count} without a printing
                </span>
              </span>
              <Link
                to="/admin/workspace/printings/create"
                search={{
                  card: card.cardSlug,
                  language: variant.language ?? undefined,
                  finish: variant.finish,
                }}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Create printing
              </Link>
            </li>
          ))}
        </ul>
      )}
      {isPending ? (
        <Skeleton className="h-24" />
      ) : isError || detail.card === null ? (
        <p className="text-muted-foreground">The card could not be loaded.</p>
      ) : (
        <CardListingsSection
          cardSlug={card.cardSlug}
          pairNames={pairNamesByPrinting(detail.printings, detail.card.name)}
        />
      )}
    </div>
  );
}
