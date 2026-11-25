import { computeProductSuggestions } from "@openrift/shared/marketplace-suggestions";
import { countNoun } from "@openrift/shared/strings";
import type {
  AdminMarketplaceName,
  AssignableCardResponse,
} from "@openrift/shared/types/api/admin";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BanIcon, EllipsisVerticalIcon, LinkIcon, PlusIcon, UnlinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { IgnoredProductsNote } from "@/features/admin/components/ignored-products-note";
import { PrintingPairNamesContext } from "@/features/admin/components/printing-pair-names";
import {
  useAssignToCardByMarketplace,
  useIgnoreProductsByMarketplace,
  useIgnoreVariantsByMarketplace,
  useUnassignFromCardByMarketplace,
} from "@/features/admin/hooks/use-unified-mappings";
import type { MarketplaceHandlers } from "@/features/admin/lib/marketplace-product-entries";
import { displayedProductLanguage } from "@/features/admin/lib/marketplace-product-entries";
import { SOURCE_CONFIGS } from "@/features/admin/lib/marketplace-sources";
import type { PrintingAssignment } from "@/features/admin/lib/printing-assignment";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { ListingPrintingDialog } from "@/features/catalog-workspace/components/listing-printing-dialog";
import { ListingsTable } from "@/features/catalog-workspace/components/listings-table";
import { ReassignCardDialog } from "@/features/catalog-workspace/components/reassign-card-dialog";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { useListingWrites } from "@/features/catalog-workspace/hooks/use-listing-writes";
import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";
import {
  buildCardListings,
  listingAssignment,
} from "@/features/catalog-workspace/lib/card-listing-rows";
import { errorText } from "@/lib/error-text";

function ListingActionsCell({
  row,
  cardSlug,
  cardName,
  allCards,
}: AdminCellSlotProps<CardListingRow> & {
  cardSlug: string;
  cardName: string;
  allCards: AssignableCardResponse[];
}) {
  if (row === undefined) {
    return null;
  }
  return <ListingActions row={row} cardSlug={cardSlug} cardName={cardName} allCards={allCards} />;
}

function ListingActions({
  row,
  cardSlug,
  cardName,
  allCards,
}: {
  row: CardListingRow;
  cardSlug: string;
  cardName: string;
  allCards: AssignableCardResponse[];
}) {
  const { marketplace, product } = row;
  const writes = useListingWrites(cardSlug, cardName);
  const { done } = writes;
  const ignoreVariant = useIgnoreVariantsByMarketplace()[marketplace];
  const ignoreProduct = useIgnoreProductsByMarketplace()[marketplace];
  const assignToCard = useAssignToCardByMarketplace()[marketplace];
  const unassign = useUnassignFromCardByMarketplace()[marketplace];
  const [dialog, setDialog] = useState<"printing" | "card" | null>(null);
  const pending =
    writes.pending ||
    ignoreVariant.isPending ||
    ignoreProduct.isPending ||
    assignToCard.isPending ||
    unassign.isPending;
  const sku = {
    externalId: product.externalId,
    finish: product.finish,
    language: product.language,
  };
  const canUnassign = row.isAssigned || product.isOverride === true;

  function assign(printingId: string) {
    const label =
      row.assignablePrintings.find((printing) => printing.printingId === printingId)?.shortCode ??
      printingId;
    void writes.map(marketplace, listingAssignment(row, printingId), label);
  }

  function runUnassign() {
    if (!row.isAssigned) {
      void done((signal) => unassign.mutateAsync(sku, { signal }));
      return;
    }
    void writes.unmap(
      marketplace,
      row.assignedPrintings.map((printing) => listingAssignment(row, printing.printingId)),
    );
  }

  function closeDialog(open: boolean) {
    if (!open) {
      setDialog(null);
    }
  }

  return (
    <>
      <span className="flex items-center justify-end gap-1.5">
        {!row.isAssigned && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            pending={writes.pending}
            onClick={() => {
              const suggested = row.suggestion?.printing.printingId;
              if (suggested === undefined) {
                setDialog("printing");
              } else {
                assign(suggested);
              }
            }}
          >
            {row.suggestion === null ? "Map…" : "Map"}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                disabled={pending}
                aria-label="Listing actions"
              />
            }
          >
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDialog("printing")}>
              <LinkIcon />
              Map to another printing…
            </DropdownMenuItem>
            {!row.isAssigned && product.isOverride !== true && (
              <DropdownMenuItem onClick={() => setDialog("card")}>
                <LinkIcon />
                Reassign to another card…
              </DropdownMenuItem>
            )}
            {!row.isAssigned && (
              <DropdownMenuItem
                render={
                  <Link
                    to="/admin/workspace/printings/create"
                    search={{
                      card: cardSlug,
                      language:
                        displayedProductLanguage(marketplace, product.language) ?? undefined,
                      finish: product.finish,
                    }}
                  />
                }
              >
                <PlusIcon />
                Create printing from this listing
              </DropdownMenuItem>
            )}
            {canUnassign && (
              <DropdownMenuItem onClick={runUnassign}>
                <UnlinkIcon />
                Unmap
              </DropdownMenuItem>
            )}
            {!row.isAssigned && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    void done((signal) => ignoreVariant.mutateAsync([sku], { signal }))
                  }
                >
                  <BanIcon />
                  Ignore this variant
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    void done((signal) =>
                      ignoreProduct.mutateAsync([{ externalId: product.externalId }], { signal }),
                    )
                  }
                >
                  <BanIcon />
                  Ignore the whole product
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
      <ListingPrintingDialog
        row={row}
        open={dialog === "printing"}
        pending={pending}
        onOpenChange={closeDialog}
        onPick={(printingId) => {
          setDialog(null);
          assign(printingId);
        }}
      />
      {dialog === "card" && (
        <ReassignCardDialog
          externalId={product.externalId}
          open
          allCards={allCards}
          pending={pending}
          onOpenChange={closeDialog}
          onPick={(cardId) => {
            setDialog(null);
            void done((signal) => assignToCard.mutateAsync({ ...sku, cardId }, { signal }));
          }}
        />
      )}
    </>
  );
}

export function CardListingsSection({
  cardSlug,
  cardName,
  pairNames,
  collapsible = false,
  defaultOpen = true,
  scrollWhenLoaded = false,
}: {
  cardSlug: string;
  cardName: string;
  pairNames: ReadonlyMap<string, string>;
  collapsible?: boolean;
  defaultOpen?: boolean;
  scrollWhenLoaded?: boolean;
}) {
  const { data, isPending, error } = useQuery(unifiedMappingsForCardQueryOptions(cardSlug));
  const loadFailed = error !== null;
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollWhenLoaded && !isPending) {
      anchor.current?.scrollIntoView();
    }
  }, [scrollWhenLoaded, isPending]);
  const writes = useListingWrites(cardSlug, cardName);
  const { done, saves: saveMappings } = writes;
  const navigate = useNavigate();
  const ignoreVariants = useIgnoreVariantsByMarketplace();
  const ignoreProducts = useIgnoreProductsByMarketplace();
  const assignToCards = useAssignToCardByMarketplace();
  const unassigns = useUnassignFromCardByMarketplace();
  const saving = writes.pending;

  const group = data?.group ?? null;
  const listings =
    group === null ? null : buildCardListings(group, computeProductSuggestions(group));
  const printingById = new Map(
    (group?.printings ?? []).map((printing) => [printing.printingId, printing]),
  );

  const handlersFor = (marketplace: AdminMarketplaceName): MarketplaceHandlers => {
    const assign = (mappings: PrintingAssignment[]) =>
      done((signal) => saveMappings[marketplace].mutateAsync({ mappings }, { signal }));
    return {
      onIgnoreVariant: (externalId, finish, language) =>
        void done((signal) =>
          ignoreVariants[marketplace].mutateAsync([{ externalId, finish, language }], { signal }),
        ),
      onIgnoreProduct: (externalId) =>
        void done((signal) =>
          ignoreProducts[marketplace].mutateAsync([{ externalId }], { signal }),
        ),
      onAssignToCard: (externalId, finish, language, cardId) =>
        void done((signal) =>
          assignToCards[marketplace].mutateAsync(
            { externalId, finish, language, cardId },
            { signal },
          ),
        ),
      onAssignToPrinting: (externalId, finish, language, printingId) =>
        writes.map(
          marketplace,
          { externalId, finish, language, printingId },
          printingById.get(printingId)?.shortCode ?? printingId,
        ),
      onBatchAssignToPrintings: (mappings) => void assign(mappings),
      onUnassign: (externalId, finish, language) =>
        void done((signal) =>
          unassigns[marketplace].mutateAsync({ externalId, finish, language }, { signal }),
        ),
      onUnmapPrinting: (printingId, externalId, finish, language) =>
        void writes.unmap(marketplace, [{ externalId, finish, language, printingId }]),
      isIgnoring: ignoreVariants[marketplace].isPending || ignoreProducts[marketplace].isPending,
      isAssigning: assignToCards[marketplace].isPending,
      isAssigningToPrinting: saveMappings[marketplace].isPending,
      isUnassigning: unassigns[marketplace].isPending,
      isUnmappingPrinting: writes.pending,
    };
  };

  function acceptStrong(strong: Record<AdminMarketplaceName, PrintingAssignment[]>) {
    for (const marketplace of ALL_MARKETPLACES) {
      const mappings = strong[marketplace];
      if (mappings.length > 0) {
        void done((signal) => saveMappings[marketplace].mutateAsync({ mappings }, { signal }));
      }
    }
  }

  return (
    <div ref={anchor} className="scroll-mt-20">
      <RecordSection
        title="Marketplace listings"
        collapsible={collapsible}
        defaultOpen={defaultOpen}
        summary={
          listings === null
            ? undefined
            : [
                countNoun(listings.unassigned.length + listings.assigned.length, "listing"),
                listings.unassigned.length > 0 ? `${listings.unassigned.length} unassigned` : null,
              ]
                .filter((part) => part !== null)
                .join(", ")
        }
        actions={
          listings !== null && (
            <>
              {listings.unassigned.length > 0 && (
                <Badge variant="warning">{listings.unassigned.length} unassigned</Badge>
              )}
              {listings.strongCount > 0 && (
                <Button
                  size="sm"
                  disabled={saving}
                  pending={saving}
                  onClick={() => acceptStrong(listings.strong)}
                >
                  Accept {listings.strongCount} strong
                </Button>
              )}
            </>
          )
        }
      >
        {isPending ? (
          <Skeleton className="h-24" />
        ) : loadFailed ? (
          <p role="alert" className="text-muted-foreground">
            The listings could not be loaded. {errorText(error, "Try again later.")}
          </p>
        ) : listings === null ? (
          <div className="space-y-2">
            <p className="text-muted-foreground">No marketplace listings point at this card.</p>
            <IgnoredProductsNote />
          </div>
        ) : (
          <PrintingPairNamesContext value={pairNames}>
            <div className="space-y-4">
              {ALL_MARKETPLACES.map((marketplace) => {
                const rows = listings.rows[marketplace];
                if (rows.length === 0) {
                  return null;
                }
                return (
                  <ListingsTable
                    key={marketplace}
                    rows={rows}
                    cardName={group?.cardName ?? ""}
                    handlers={handlersFor(marketplace)}
                    minWidth="min-w-[44rem]"
                    onOpenPrinting={(printingId) =>
                      void navigate({
                        to: "/admin/workspace/printings/$printingId",
                        params: { printingId },
                      })
                    }
                    toolbar={
                      <SectionHeading as="h4" size="sm">
                        {SOURCE_CONFIGS[marketplace].displayName}
                      </SectionHeading>
                    }
                    actions={
                      <ListingActionsCell
                        cardSlug={cardSlug}
                        cardName={cardName}
                        allCards={data?.allCards ?? []}
                      />
                    }
                  />
                );
              })}
              <IgnoredProductsNote />
            </div>
          </PrintingPairNamesContext>
        )}
      </RecordSection>
    </div>
  );
}
