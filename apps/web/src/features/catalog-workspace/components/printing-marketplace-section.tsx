import { enumLabel } from "@openrift/shared/enum-label";
import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { computeProductSuggestions } from "@openrift/shared/marketplace-suggestions";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronRightIcon, EllipsisVerticalIcon, UnlinkIcon } from "lucide-react";

import { MarketplaceIcon } from "@/components/marketplace-icon";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TextLink } from "@/components/ui/text-link";
import { displayedProductLanguage } from "@/features/admin/lib/marketplace-product-entries";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { usePricesOnDemand } from "@/features/cards/hooks/use-prices";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { useListingWrites } from "@/features/catalog-workspace/hooks/use-listing-writes";
import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";
import {
  buildCardListings,
  listingAssignment,
} from "@/features/catalog-workspace/lib/card-listing-rows";
import type { MarketplaceCoverage } from "@/features/catalog-workspace/lib/printing-marketplace-coverage";
import {
  mappingKey,
  marketplaceCoverage,
  pickableListings,
} from "@/features/catalog-workspace/lib/printing-marketplace-coverage";
import { useEnumOrders } from "@/hooks/use-enums";
import { formatterForMarketplace } from "@/lib/format";

type Mapping = AdminCardDetailResponse["marketplaceMappings"][number];

export function PrintingMarketplaceSection({
  printingId,
  cardSlug,
  otherCardSlugs,
  cardName,
  language,
  mappings: mapped,
}: {
  printingId: string;
  cardSlug: string;
  otherCardSlugs: readonly string[];
  cardName: string;
  language: string;
  mappings: readonly Mapping[];
}) {
  const { data: mappings } = useQuery(unifiedMappingsForCardQueryOptions(cardSlug));
  const prices = usePricesOnDemand(true);
  const group = mappings?.group ?? null;
  const unassigned =
    mappings === undefined
      ? null
      : group === null
        ? []
        : buildCardListings(group, computeProductSuggestions(group)).unassigned;
  const rows = marketplaceCoverage(mapped, printingId, language);

  return (
    <RecordSection
      title="Marketplace"
      actions={
        <Link
          to="/admin/workspace/cards/$cardSlug"
          params={{ cardSlug }}
          hash="listings"
          state={{ workspaceFromPrintingId: printingId }}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          All listings of {cardName}
          <ChevronRightIcon />
        </Link>
      }
    >
      <ul className="divide-y">
        {rows.map((row) => (
          <li
            key={row.marketplace}
            className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0"
          >
            <span className="flex w-32 shrink-0 items-center gap-2 font-medium">
              <MarketplaceIcon marketplace={row.marketplace} alt="" />
              {MARKETPLACE_LINKS[row.marketplace].label}
            </span>
            <CoverageBody
              row={row}
              printingId={printingId}
              language={language}
              cardSlug={cardSlug}
              otherCardSlugs={otherCardSlugs}
              candidates={
                unassigned === null
                  ? null
                  : pickableListings(unassigned, row.marketplace, printingId)
              }
              cardName={cardName}
            />
            {row.products.length > 0 && (
              <span className="w-20 shrink-0 text-right font-semibold tabular-nums">
                {formatterForMarketplace(row.marketplace)(prices?.get(printingId, row.marketplace))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </RecordSection>
  );
}

function CoverageBody({
  row,
  printingId,
  language,
  cardSlug,
  otherCardSlugs,
  cardName,
  candidates,
}: {
  row: MarketplaceCoverage;
  printingId: string;
  language: string;
  cardSlug: string;
  otherCardSlugs: readonly string[];
  cardName: string;
  candidates: CardListingRow[] | null;
}) {
  if (row.products.length > 0) {
    return (
      <ul className="min-w-0 flex-1 space-y-1">
        {row.products.map((product) => (
          <MappedProduct
            key={mappingKey(product)}
            product={product}
            printingId={printingId}
            language={language}
            cardSlug={cardSlug}
            otherCardSlugs={otherCardSlugs}
            cardName={cardName}
          />
        ))}
      </ul>
    );
  }
  if (!row.carriesLanguage) {
    return (
      <span className="text-muted-foreground min-w-0 flex-1">Does not sell this language</span>
    );
  }
  if (candidates === null) {
    return <span className="text-muted-foreground min-w-0 flex-1">Not mapped</span>;
  }
  return (
    <>
      <span className="text-muted-foreground min-w-0 flex-1">
        {candidates.length === 0 ? "Not mapped, no unassigned listing of this card" : "Not mapped"}
      </span>
      {candidates.length > 0 && (
        <MapListingMenu
          marketplace={row.marketplace}
          printingId={printingId}
          cardSlug={cardSlug}
          otherCardSlugs={otherCardSlugs}
          cardName={cardName}
          candidates={candidates}
        />
      )}
    </>
  );
}

function MapListingMenu({
  marketplace,
  printingId,
  cardSlug,
  otherCardSlugs,
  cardName,
  candidates,
}: {
  marketplace: Marketplace;
  printingId: string;
  cardSlug: string;
  otherCardSlugs: readonly string[];
  cardName: string;
  candidates: CardListingRow[];
}) {
  const { labels } = useEnumOrders();
  const writes = useListingWrites(cardSlug, cardName, otherCardSlugs);

  const map = (listing: CardListingRow) =>
    void writes.map(marketplace, listingAssignment(listing, printingId), "this printing");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" disabled={writes.pending} />}
      >
        Map
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto max-w-96">
        {candidates.map((listing) => (
          <DropdownMenuItem key={listing.key} onClick={() => map(listing)}>
            <span className="min-w-0 flex-1 truncate">{listing.product.productName}</span>
            <span className="text-muted-foreground font-mono text-sm">
              #{listing.product.externalId}
            </span>
            <span className="text-muted-foreground text-sm">
              {[
                enumLabel(labels.finishes, listing.product.finish),
                displayedProductLanguage(listing.marketplace, listing.product.language),
              ]
                .filter((part) => part !== null)
                .join(" · ")}
            </span>
            {listing.suggestion?.printing.printingId === printingId && (
              <Badge variant="success">suggested</Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MappedProduct({
  product,
  printingId,
  language,
  cardSlug,
  otherCardSlugs,
  cardName,
}: {
  product: Mapping;
  printingId: string;
  language: string;
  cardSlug: string;
  otherCardSlugs: readonly string[];
  cardName: string;
}) {
  const { labels } = useEnumOrders();
  const writes = useListingWrites(cardSlug, cardName, otherCardSlugs);
  const detail = [enumLabel(labels.finishes, product.finish), product.variantLanguage]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <li className="flex items-center gap-2">
      <span className="min-w-0 flex-1">
        <TextLink
          href={MARKETPLACE_LINKS[product.marketplace].productUrl(product.externalId, language)}
          target="_blank"
          rel="noreferrer"
        >
          {product.productName}
        </TextLink>{" "}
        <span className="text-muted-foreground font-mono text-sm">#{product.externalId}</span>{" "}
        <span className="text-muted-foreground text-sm">{detail}</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
          <EllipsisVerticalIcon />
          <span className="sr-only">Actions for {product.productName}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={writes.pending}
            onClick={() =>
              void writes.unmap(product.marketplace, [
                {
                  printingId,
                  externalId: product.externalId,
                  finish: product.finish,
                  language: product.variantLanguage,
                },
              ])
            }
          >
            <UnlinkIcon />
            Unmap
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
