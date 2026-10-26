import { marketplaceLabel } from "@openrift/shared/marketplace";
import { computeProductSuggestions } from "@openrift/shared/marketplace-suggestions";
import type {
  AdminMarketplaceName,
  AssignableCardResponse,
} from "@openrift/shared/types/api/admin";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BanIcon, EllipsisVerticalIcon, LinkIcon, XIcon } from "lucide-react";
import { useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { IgnoredProductsNote } from "@/features/admin/components/ignored-products-note";
import { PrintingLabel } from "@/features/admin/components/marketplace-printing-label";
import { MARKETPLACE_CONFIGS } from "@/features/admin/components/marketplace-product-entries";
import { ProductLink } from "@/features/admin/components/price-mappings-utils";
import { PrintingPairNamesContext } from "@/features/admin/components/printing-pair-names";
import { useUnmapMarketplacePrinting } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useUnifiedAssignToCard,
  useUnifiedIgnoreProducts,
  useUnifiedIgnoreVariants,
  useUnifiedSaveMappings,
  useUnifiedUnassignFromCard,
} from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAssignableCardSearch } from "@/features/cards/hooks/use-card-search";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import type {
  CardListingRow,
  ListingStrength,
  PrintingAssignment,
} from "@/features/catalog-workspace/lib/card-listing-rows";
import {
  buildCardListings,
  listingAssignment,
} from "@/features/catalog-workspace/lib/card-listing-rows";

const STRENGTH_VARIANT: Record<ListingStrength, "success" | "warning" | "neutral"> = {
  strong: "success",
  possible: "warning",
  weak: "neutral",
};

function useListingDone(cardSlug: string) {
  const queryClient = useQueryClient();
  return {
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.cards.detail(cardSlug) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.unifiedMappings.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.workspace }),
      ]);
    },
  };
}

function PrintingPickerDialog({
  row,
  open,
  pending,
  onOpenChange,
  onPick,
}: {
  row: CardListingRow;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (printingId: string) => void;
}) {
  const assignedIds = new Set(row.assignedPrintings.map((printing) => printing.printingId));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign #{row.product.externalId} to a printing</DialogTitle>
        </DialogHeader>
        {row.assignablePrintings.length === 0 ? (
          <p className="text-muted-foreground">No printing of this card carries its language.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {row.assignablePrintings.map((printing) => (
              <Button
                key={printing.printingId}
                variant="outline"
                className="justify-start font-mono"
                disabled={pending || assignedIds.has(printing.printingId)}
                onClick={() => onPick(printing.printingId)}
              >
                <PrintingLabel
                  printing={printing}
                  highlightFinish={row.product.finish}
                  highlightLanguage={row.product.language ?? undefined}
                />
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
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

function ListingRow({
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
    save.mutate({ mappings: [listingAssignment(row, printingId)] }, done);
  }

  function runUnassign() {
    if (!row.isAssigned) {
      unassign.mutate(sku, done);
      return;
    }
    for (const printing of row.assignedPrintings) {
      unmap.mutate({ marketplace, printingId: printing.printingId, ...sku });
    }
  }

  function closeDialog(open: boolean) {
    if (!open) {
      setDialog(null);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 border-t py-1.5">
      <Badge variant="outline">{marketplaceLabel(marketplace)}</Badge>
      <span className="min-w-0 flex-1 break-words">
        <ProductLink
          config={MARKETPLACE_CONFIGS[marketplace]}
          externalId={product.externalId}
          language={product.language}
        >
          &ldquo;{product.productName}&rdquo;
        </ProductLink>{" "}
        <span className="text-muted-foreground text-sm">
          {[product.finish, product.language].filter(Boolean).join(" · ")}
        </span>{" "}
        {row.isAssigned ? (
          <span className="font-mono text-sm">
            <span className="text-muted-foreground font-sans">&rarr; </span>
            {row.assignedPrintings.map((printing, index) => (
              <span key={printing.printingId}>
                {index > 0 && ", "}
                <PrintingLabel printing={printing} />
              </span>
            ))}
          </span>
        ) : row.suggestion === null ? (
          <span className="text-muted-foreground text-sm">&rarr; no match</span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">&rarr; suggested</span>
            <span className="font-mono">
              <PrintingLabel
                printing={row.suggestion.printing}
                highlightFinish={product.finish}
                highlightLanguage={product.language ?? undefined}
              />
            </span>
            <Badge variant={STRENGTH_VARIANT[row.suggestion.strength]}>
              {row.suggestion.strength}
            </Badge>
          </span>
        )}
      </span>
      <span className="flex items-center gap-1.5">
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
            {canUnassign && (
              <DropdownMenuItem onClick={runUnassign}>
                <XIcon />
                Unassign
              </DropdownMenuItem>
            )}
            {!row.isAssigned && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => ignoreVariant.mutate([sku], done)}>
                  <BanIcon />
                  Ignore this variant
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => ignoreProduct.mutate([{ externalId: product.externalId }], done)}
                >
                  <BanIcon />
                  Ignore the whole product
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
      <PrintingPickerDialog
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
            assignToCard.mutate({ ...sku, cardId }, done);
          }}
        />
      )}
    </li>
  );
}

export function CardListingsSection({
  cardSlug,
  pairNames,
}: {
  cardSlug: string;
  pairNames: ReadonlyMap<string, string>;
}) {
  const { data, isPending } = useQuery(unifiedMappingsForCardQueryOptions(cardSlug));
  const done = useListingDone(cardSlug);
  const saves: Record<AdminMarketplaceName, ReturnType<typeof useUnifiedSaveMappings>> = {
    tcgplayer: useUnifiedSaveMappings("tcgplayer"),
    cardmarket: useUnifiedSaveMappings("cardmarket"),
    cardtrader: useUnifiedSaveMappings("cardtrader"),
    cardnexus: useUnifiedSaveMappings("cardnexus"),
  };
  const [showAll, setShowAll] = useState(false);
  const saving = ALL_MARKETPLACES.some((marketplace) => saves[marketplace].isPending);

  const group = data?.group ?? null;
  const listings =
    group === null ? null : buildCardListings(group, computeProductSuggestions(group));

  function acceptStrong(strong: Record<AdminMarketplaceName, PrintingAssignment[]>) {
    for (const marketplace of ALL_MARKETPLACES) {
      const mappings = strong[marketplace];
      if (mappings.length > 0) {
        saves[marketplace].mutate({ mappings }, done);
      }
    }
  }

  return (
    <RecordSection
      title="Marketplace listings"
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
          <div className="space-y-2">
            {listings.unassigned.length === 0 && (
              <p className="text-muted-foreground">Every listing of this card is assigned.</p>
            )}
            <ul>
              {[...listings.unassigned, ...(showAll ? listings.assigned : [])].map((row) => (
                <ListingRow
                  key={row.key}
                  row={row}
                  cardSlug={cardSlug}
                  allCards={data?.allCards ?? []}
                />
              ))}
            </ul>
            {listings.assigned.length > 0 && (
              <p className="text-muted-foreground text-sm">
                {showAll
                  ? `${listings.assigned.length} assigned shown.`
                  : `${listings.assigned.length} assigned hidden.`}{" "}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? "Hide assigned" : "Show all"}
                </Button>
              </p>
            )}
            <IgnoredProductsNote />
          </div>
        </PrintingPairNamesContext>
      )}
    </RecordSection>
  );
}
