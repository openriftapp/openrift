import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";
import { computeProductSuggestions } from "@openrift/shared/marketplace-suggestions";
import { countNoun } from "@openrift/shared/strings";
import type {
  AdminMarketplaceName,
  AssignableCardResponse,
} from "@openrift/shared/types/api/admin";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BanIcon, EllipsisVerticalIcon, LinkIcon, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { AdminTable } from "@/features/admin/components/admin-table";
import { IgnoredProductsNote } from "@/features/admin/components/ignored-products-note";
import type { RowSuggestion } from "@/features/admin/components/marketplace-product-cells";
import {
  AssignedPrintingsCell,
  PriceCell,
  ProductCell,
  VariantCell,
} from "@/features/admin/components/marketplace-product-cells";
import type {
  MarketplaceHandlers,
  MarketplaceTableRow,
} from "@/features/admin/components/marketplace-product-entries";
import {
  buildMarketplaceRows,
  collectEntries,
  displayedProductLanguage,
} from "@/features/admin/components/marketplace-product-entries";
import { PrintingPairNamesContext } from "@/features/admin/components/printing-pair-names";
import { useUnmapMarketplacePrinting } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useAssignToCardByMarketplace,
  useIgnoreProductsByMarketplace,
  useIgnoreVariantsByMarketplace,
  useUnassignFromCardByMarketplace,
  useUnifiedAssignToCard,
  useUnifiedIgnoreProducts,
  useUnifiedIgnoreVariants,
  useSaveMappingsByMarketplace,
  useUnifiedSaveMappings,
  useUnifiedUnassignFromCard,
} from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { SOURCE_CONFIGS } from "@/features/admin/lib/marketplace-sources";
import type { PrintingAssignment } from "@/features/admin/lib/printing-assignment";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAssignableCardSearch } from "@/features/cards/hooks/use-card-search";
import { ListingPrintingDialog } from "@/features/catalog-workspace/components/listing-printing-dialog";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";
import {
  buildCardListings,
  listingAssignment,
} from "@/features/catalog-workspace/lib/card-listing-rows";
import { runReportedMutation } from "@/lib/run-reported-mutation";

function useListingDone(cardSlug: string) {
  const queueWrite = useQueueWorkspaceWrite();
  const queryClient = useQueryClient();
  return (run: (signal: AbortSignal) => Promise<unknown>) =>
    queueWrite(async (signal) => {
      if (!(await runReportedMutation(() => run(signal)))) {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.cards.detail(cardSlug) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.unifiedMappings.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.workspace }),
      ]);
    });
}

function ReassignCardDialog({
  row,
  open,
  allCards,
  pending,
  onOpenChange,
  onPick,
}: {
  row: CardListingRow;
  open: boolean;
  allCards: AssignableCardResponse[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (cardId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useAssignableCardSearch(allCards, query);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move #{row.product.externalId} to another card</DialogTitle>
        </DialogHeader>
        <CardSearchDropdown
          results={results}
          onSearch={setQuery}
          onSelect={(cardId) => onPick(cardId)}
          disabled={pending}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- admin-only dialog, the search is its only control
          autoFocus
        />
      </DialogContent>
    </Dialog>
  );
}

function ListingActionsCell({
  row,
  listingsByKey,
  cardSlug,
  allCards,
}: AdminCellSlotProps<MarketplaceTableRow> & {
  listingsByKey: ReadonlyMap<string, CardListingRow>;
  cardSlug: string;
  allCards: AssignableCardResponse[];
}) {
  const listing = row === undefined ? undefined : listingsByKey.get(row.key);
  if (listing === undefined) {
    return null;
  }
  return <ListingActions row={listing} cardSlug={cardSlug} allCards={allCards} />;
}

function ListingActions({
  row,
  cardSlug,
  allCards,
}: {
  row: CardListingRow;
  cardSlug: string;
  allCards: AssignableCardResponse[];
}) {
  const { marketplace, product } = row;
  const done = useListingDone(cardSlug);
  const save = useUnifiedSaveMappings(marketplace);
  const ignoreVariant = useUnifiedIgnoreVariants(marketplace);
  const ignoreProduct = useUnifiedIgnoreProducts(marketplace);
  const assignToCard = useUnifiedAssignToCard(marketplace);
  const unassign = useUnifiedUnassignFromCard(marketplace);
  const unmap = useUnmapMarketplacePrinting([
    adminKeys.cards.detail(cardSlug),
    adminKeys.unifiedMappings.all,
    adminKeys.workspace,
  ]);
  const [dialog, setDialog] = useState<"printing" | "card" | null>(null);
  const pending =
    save.isPending ||
    ignoreVariant.isPending ||
    ignoreProduct.isPending ||
    assignToCard.isPending ||
    unassign.isPending ||
    unmap.isPending;
  const sku = {
    externalId: product.externalId,
    finish: product.finish,
    language: product.language,
  };
  const canUnassign = row.isAssigned || product.isOverride === true;

  function assign(printingId: string) {
    void done((signal) =>
      save.mutateAsync({ mappings: [listingAssignment(row, printingId)] }, { signal }),
    );
  }

  function runUnassign() {
    if (!row.isAssigned) {
      void done((signal) => unassign.mutateAsync(sku, { signal }));
      return;
    }
    void done((signal) =>
      Promise.all(
        row.assignedPrintings.map((printing) =>
          unmap.mutateAsync({ marketplace, printingId: printing.printingId, ...sku }, { signal }),
        ),
      ),
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
            onClick={() => {
              const suggested = row.suggestion?.printing.printingId;
              if (suggested === undefined) {
                setDialog("printing");
              } else {
                assign(suggested);
              }
            }}
          >
            {row.suggestion === null ? "Assign…" : "Assign"}
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
              Assign to another printing…
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
                <XIcon />
                Unassign
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
          row={row}
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
  pairNames,
  collapsible = false,
  defaultOpen = true,
  scrollWhenLoaded = false,
}: {
  cardSlug: string;
  pairNames: ReadonlyMap<string, string>;
  collapsible?: boolean;
  defaultOpen?: boolean;
  scrollWhenLoaded?: boolean;
}) {
  const { data, isPending } = useQuery(unifiedMappingsForCardQueryOptions(cardSlug));
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollWhenLoaded && !isPending) {
      anchor.current?.scrollIntoView();
    }
  }, [scrollWhenLoaded, isPending]);
  const done = useListingDone(cardSlug);
  const saves = useSaveMappingsByMarketplace();
  const navigate = useNavigate();
  const ignoreVariants = useIgnoreVariantsByMarketplace();
  const ignoreProducts = useIgnoreProductsByMarketplace();
  const assignToCards = useAssignToCardByMarketplace();
  const unassigns = useUnassignFromCardByMarketplace();
  const unmap = useUnmapMarketplacePrinting([
    adminKeys.cards.detail(cardSlug),
    adminKeys.unifiedMappings.all,
    adminKeys.workspace,
  ]);
  const saving = ALL_MARKETPLACES.some((marketplace) => saves[marketplace].isPending);

  const group = data?.group ?? null;
  const suggestions = group === null ? null : computeProductSuggestions(group);
  const listings =
    group === null || suggestions === null ? null : buildCardListings(group, suggestions);
  const listingsByKey = new Map(
    [...(listings?.unassigned ?? []), ...(listings?.assigned ?? [])].map((row) => [row.key, row]),
  );
  const entries = group === null ? [] : collectEntries(group);
  const printingById = new Map(
    (group?.printings ?? []).map((printing) => [printing.printingId, printing]),
  );

  const handlersFor = (marketplace: AdminMarketplaceName): MarketplaceHandlers => {
    const assign = (mappings: PrintingAssignment[]) =>
      done((signal) => saves[marketplace].mutateAsync({ mappings }, { signal }));
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
        assign([{ externalId, finish, language, printingId }]),
      onBatchAssignToPrintings: (mappings) => void assign(mappings),
      onUnassign: (externalId, finish, language) =>
        void done((signal) =>
          unassigns[marketplace].mutateAsync({ externalId, finish, language }, { signal }),
        ),
      onUnmapPrinting: (printingId, externalId, finish, language) =>
        void done((signal) =>
          unmap.mutateAsync({ marketplace, printingId, externalId, finish, language }, { signal }),
        ),
      isIgnoring: ignoreVariants[marketplace].isPending || ignoreProducts[marketplace].isPending,
      isAssigning: assignToCards[marketplace].isPending,
      isAssigningToPrinting: saves[marketplace].isPending,
      isUnassigning: unassigns[marketplace].isPending,
      isUnmappingPrinting: unmap.isPending,
    };
  };

  function acceptStrong(strong: Record<AdminMarketplaceName, PrintingAssignment[]>) {
    for (const marketplace of ALL_MARKETPLACES) {
      const mappings = strong[marketplace];
      if (mappings.length > 0) {
        void done((signal) => saves[marketplace].mutateAsync({ mappings }, { signal }));
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
                countNoun(listingsByKey.size, "listing"),
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
                <Button size="sm" disabled={saving} onClick={() => acceptStrong(listings.strong)}>
                  Accept {listings.strongCount} strong
                </Button>
              )}
            </>
          )
        }
      >
        {isPending ? (
          <Skeleton className="h-24" />
        ) : listings === null ? (
          <div className="space-y-2">
            <p className="text-muted-foreground">No marketplace listings point at this card.</p>
            <IgnoredProductsNote />
          </div>
        ) : (
          <PrintingPairNamesContext value={pairNames}>
            <div className="space-y-4">
              {ALL_MARKETPLACES.map((marketplace) => {
                const rows = buildMarketplaceRows(entries, marketplace);
                if (rows.length === 0) {
                  return null;
                }
                const suggestionsByKey = new Map<string, RowSuggestion[]>(
                  rows.map((row) => [
                    row.key,
                    (
                      suggestions?.get(
                        marketplaceSkuKey(
                          marketplace,
                          row.entry.product.externalId,
                          row.entry.product.finish,
                          row.entry.product.language,
                        ),
                      ) ?? []
                    ).flatMap((suggestion) => {
                      const printing = printingById.get(suggestion.printingId);
                      return printing ? [{ ...suggestion, printing }] : [];
                    }),
                  ]),
                );
                return (
                  <AdminTable<MarketplaceTableRow>
                    key={marketplace}
                    columns={[
                      {
                        header: "Product",
                        width: "w-72",
                        wrap: true,
                        cell: <ProductCell cardName={group?.cardName ?? ""} />,
                      },
                      { header: "Variant", width: "w-32", cell: <VariantCell /> },
                      { header: "Price", width: "w-24", align: "right", cell: <PriceCell /> },
                      {
                        header: "Assigned printings",
                        wrap: true,
                        cell: (
                          <AssignedPrintingsCell
                            handlers={handlersFor(marketplace)}
                            suggestionsByKey={suggestionsByKey}
                            onOpenPrinting={(printingId) =>
                              void navigate({
                                to: "/admin/workspace/printings/$printingId",
                                params: { printingId },
                              })
                            }
                          />
                        ),
                      },
                    ]}
                    data={rows}
                    getRowKey={(row) => row.key}
                    minWidth="min-w-[44rem]"
                    toolbar={
                      <SectionHeading as="h4" size="sm">
                        {SOURCE_CONFIGS[marketplace].displayName}
                      </SectionHeading>
                    }
                    actions={
                      <ListingActionsCell
                        listingsByKey={listingsByKey}
                        cardSlug={cardSlug}
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
