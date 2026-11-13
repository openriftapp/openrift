import { enumLabel } from "@openrift/shared/enum-label";
import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";
import { matchesTextQuery } from "@openrift/shared/search-fold";
import type {
  AssignableCardResponse,
  StagedProductResponse,
} from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { useNavigate } from "@tanstack/react-router";
import { BanIcon, EllipsisVerticalIcon, LinkIcon, XIcon } from "lucide-react";
import React, { useState } from "react";

import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminFilterSelect } from "@/features/admin/components/admin-filters";
import { AdminTableGroupRow } from "@/features/admin/components/admin-table-group-row";
import { ListingPrice } from "@/features/admin/components/marketplace-product-cells";
import { displayedProductLanguage } from "@/features/admin/components/marketplace-product-entries";
import {
  useAssignToCardByMarketplace,
  useIgnoreProductsByMarketplace,
  useIgnoreVariantsByMarketplace,
  useUnifiedMappings,
} from "@/features/admin/hooks/use-unified-mappings";
import { ADMIN_TABLE_CLASS, ADMIN_TABLE_SURFACE } from "@/features/admin/lib/admin-table-styles";
import { SOURCE_CONFIGS } from "@/features/admin/lib/marketplace-sources";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAssignableCardSearch } from "@/features/cards/hooks/use-card-search";
import { useEnumOrders } from "@/hooks/use-enums";

import { ProductLink } from "./price-mappings-utils";

const COLUMN_COUNT = 7;

interface UnmatchedRow {
  marketplace: Marketplace;
  product: StagedProductResponse;
}

function flattenUnmatched(data: {
  unmatchedProducts: Record<Marketplace, StagedProductResponse[]>;
}): UnmatchedRow[] {
  const rows: UnmatchedRow[] = [];
  for (const marketplace of ALL_MARKETPLACES) {
    for (const product of data.unmatchedProducts[marketplace]) {
      rows.push({ marketplace, product });
    }
  }
  return rows;
}

/** The card-detail route is keyed by `cardSlug`, not the UUID. */
export function buildAssignSuccessNavigation(
  marketplace: Marketplace,
  product: { finish: string; language: string | null },
  card: { cardSlug: string },
) {
  return {
    to: "/admin/cards/$cardSlug" as const,
    params: { cardSlug: card.cardSlug },
    search: {
      focusMarketplace: marketplace,
      focusFinish: product.finish,
      // CM/TCG have no per-language SKU; fall back to empty so the search param
      // is always a string (TanStack Router rejects undefined keys).
      focusLanguage: product.language ?? "",
    },
  };
}

export function UnmatchedProductsPanel() {
  const navigate = useNavigate();
  const { data } = useUnifiedMappings();

  const [marketplaceFilter, setMarketplaceFilter] = useState<"all" | Marketplace>("all");
  const [finishFilter, setFinishFilter] = useState<"all" | string>("all");
  const [languageFilter, setLanguageFilter] = useState<"all" | string>("all");
  const [search, setSearch] = useState("");

  const allRows = flattenUnmatched(data);

  const availableFinishes = [...new Set(allRows.map((row) => row.product.finish))].toSorted();
  const availableLanguages = [
    ...new Set(allRows.map((row) => row.product.language).filter((l): l is string => l !== null)),
  ].toSorted();

  const filtered = allRows.filter((row) => {
    if (marketplaceFilter !== "all" && row.marketplace !== marketplaceFilter) {
      return false;
    }
    if (finishFilter !== "all" && row.product.finish !== finishFilter) {
      return false;
    }
    if (languageFilter !== "all" && row.product.language !== languageFilter) {
      return false;
    }
    if (!matchesTextQuery(search, [row.product.productName])) {
      return false;
    }
    return true;
  });

  // Matches the row order of the per-card marketplace table.
  const sortedRows = [...filtered].sort(
    (a, b) =>
      ALL_MARKETPLACES.indexOf(a.marketplace) - ALL_MARKETPLACES.indexOf(b.marketplace) ||
      a.product.productName.localeCompare(b.product.productName) ||
      b.product.finish.localeCompare(a.product.finish) ||
      (a.product.language ?? "").localeCompare(b.product.language ?? "") ||
      a.product.externalId - b.product.externalId,
  );

  const assigns = useAssignToCardByMarketplace();
  const ignoreVariants = useIgnoreVariantsByMarketplace();
  const ignoreProducts = useIgnoreProductsByMarketplace();

  function mutationsFor(marketplace: Marketplace) {
    return {
      assign: assigns[marketplace],
      ignoreVariant: ignoreVariants[marketplace],
      ignoreProduct: ignoreProducts[marketplace],
    };
  }

  function handleAssignToCard(
    marketplace: Marketplace,
    product: StagedProductResponse,
    card: { cardId: string; cardSlug: string },
  ) {
    const mutations = mutationsFor(marketplace);
    mutations.assign.mutate(
      {
        externalId: product.externalId,
        finish: product.finish,
        language: product.language,
        cardId: card.cardId,
      },
      {
        onSuccess: () => {
          void navigate(buildAssignSuccessNavigation(marketplace, product, card));
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar
        marketplaceFilter={marketplaceFilter}
        onMarketplaceChange={setMarketplaceFilter}
        finishFilter={finishFilter}
        onFinishChange={setFinishFilter}
        availableFinishes={availableFinishes}
        languageFilter={languageFilter}
        onLanguageChange={setLanguageFilter}
        availableLanguages={availableLanguages}
        search={search}
        onSearchChange={setSearch}
        totalCount={allRows.length}
        filteredCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyDescription>
              {allRows.length === 0
                ? "No unmatched products."
                : "No matches for the current filters."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className={ADMIN_TABLE_SURFACE}>
          <Table className={ADMIN_TABLE_CLASS}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-16">Language</TableHead>
                <TableHead>Set</TableHead>
                <TableHead className="w-16">Finish</TableHead>
                <TableHead className="w-20 text-right">Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row, index) => {
                const { marketplace, product } = row;
                const key = marketplaceSkuKey(
                  marketplace,
                  product.externalId,
                  product.finish,
                  product.language,
                );
                const prevRow = sortedRows[index - 1];
                const isFirstOfMarketplace = !prevRow || prevRow.marketplace !== marketplace;
                const mutations = mutationsFor(marketplace);
                return (
                  <React.Fragment key={key}>
                    {isFirstOfMarketplace && (
                      <AdminTableGroupRow colSpan={COLUMN_COUNT}>
                        {SOURCE_CONFIGS[marketplace].displayName}
                      </AdminTableGroupRow>
                    )}
                    <UnmatchedProductRow
                      marketplace={marketplace}
                      product={product}
                      allCards={data.allCards as AssignableCardResponse[]}
                      onAssignToCard={(card) => handleAssignToCard(marketplace, product, card)}
                      isAssigning={mutations.assign.isPending}
                      onIgnoreVariant={() =>
                        mutations.ignoreVariant.mutate([
                          {
                            externalId: product.externalId,
                            finish: product.finish,
                            language: product.language,
                          },
                        ])
                      }
                      onIgnoreProduct={() =>
                        mutations.ignoreProduct.mutate([{ externalId: product.externalId }])
                      }
                      isIgnoring={
                        mutations.ignoreVariant.isPending || mutations.ignoreProduct.isPending
                      }
                    />
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function UnmatchedProductRow({
  marketplace,
  product,
  allCards,
  onAssignToCard,
  isAssigning,
  onIgnoreVariant,
  onIgnoreProduct,
  isIgnoring,
}: {
  marketplace: Marketplace;
  product: StagedProductResponse;
  allCards: AssignableCardResponse[];
  onAssignToCard: (card: { cardId: string; cardSlug: string }) => void;
  isAssigning: boolean;
  onIgnoreVariant: () => void;
  onIgnoreProduct: () => void;
  isIgnoring: boolean;
}) {
  const { labels } = useEnumOrders();
  const [showAssign, setShowAssign] = useState(false);
  const [cardSearchQuery, setCardSearchQuery] = useState("");

  const config = SOURCE_CONFIGS[marketplace];

  const filteredResults = useAssignableCardSearch(allCards, cardSearchQuery);

  return (
    <>
      <TableRow>
        <TableCell className="w-20">
          <ProductLink config={config} externalId={product.externalId}>
            #{product.externalId}
          </ProductLink>
        </TableCell>
        <TableCell className="max-w-0">
          <span className="block truncate font-medium" title={product.productName}>
            {product.productName}
          </span>
        </TableCell>
        <TableCell className="text-muted-foreground w-16">
          {displayedProductLanguage(marketplace, product.language) ?? (
            <span className="text-muted-foreground/50">—</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground max-w-0">
          <span className="block truncate" title={product.groupName ?? undefined}>
            {product.groupName ?? <span className="text-muted-foreground/50">—</span>}
          </span>
        </TableCell>
        <TableCell className="w-16">
          <Badge variant="outline">{enumLabel(labels.finishes, product.finish)}</Badge>
        </TableCell>
        <TableCell className="w-20 text-right tabular-nums">
          <ListingPrice marketplace={marketplace} product={product} />
        </TableCell>
        <TableCell className="py-0">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={isAssigning}
              onClick={() => setShowAssign((v) => !v)}
              title="Assign this product to a card"
            >
              {showAssign ? <XIcon /> : <LinkIcon />}
              {showAssign ? "Cancel" : "Assign"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" title="More actions">
                    <EllipsisVerticalIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={isIgnoring}
                  onClick={onIgnoreProduct}
                  title="Ignore every SKU of this upstream product"
                >
                  <BanIcon className="size-3.5" />
                  Ignore entire product
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isIgnoring}
                  onClick={onIgnoreVariant}
                  title="Ignore this specific finish/language SKU"
                >
                  <BanIcon className="size-3.5" />
                  Ignore variant
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
      {showAssign && (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT} className="bg-muted/30">
            <div className="max-w-md">
              <CardSearchDropdown
                results={filteredResults}
                onSearch={setCardSearchQuery}
                onSelect={(cardId) => {
                  // The card-detail route is keyed by slug, not id.
                  const card = allCards.find((c) => c.cardId === cardId);
                  if (!card) {
                    return;
                  }
                  onAssignToCard({ cardId: card.cardId, cardSlug: card.cardSlug });
                  setShowAssign(false);
                  setCardSearchQuery("");
                }}
                disabled={isAssigning}
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- admin-only UI, autofocus is intentional
                autoFocus
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function FilterBar({
  marketplaceFilter,
  onMarketplaceChange,
  finishFilter,
  onFinishChange,
  availableFinishes,
  languageFilter,
  onLanguageChange,
  availableLanguages,
  search,
  onSearchChange,
  totalCount,
  filteredCount,
}: {
  marketplaceFilter: "all" | Marketplace;
  onMarketplaceChange: (value: "all" | Marketplace) => void;
  finishFilter: "all" | string;
  onFinishChange: (value: "all" | string) => void;
  availableFinishes: string[];
  languageFilter: "all" | string;
  onLanguageChange: (value: "all" | string) => void;
  availableLanguages: string[];
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
}) {
  const { labels } = useEnumOrders();
  const marketplaceItems: { value: "all" | Marketplace; label: string }[] = [
    { value: "all", label: "All marketplaces" },
    ...(Object.keys(MARKETPLACE_LINKS) as Marketplace[]).map((value) => ({
      value,
      label: MARKETPLACE_LINKS[value].label,
    })),
  ];
  const finishItems = [
    { value: "all", label: "All finishes" },
    ...availableFinishes.map((finish) => ({
      value: finish,
      label: enumLabel(labels.finishes, finish),
    })),
  ];
  const languageItems = [
    { value: "all", label: "All languages" },
    ...availableLanguages.map((lang) => ({ value: lang, label: lang })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminFilterSelect
        options={marketplaceItems}
        value={marketplaceFilter}
        onChange={onMarketplaceChange}
        label="Filter by marketplace"
        className="w-44"
      />

      <AdminFilterSelect
        options={finishItems}
        value={finishFilter}
        onChange={onFinishChange}
        label="Filter by finish"
        className="w-36"
      />

      <AdminFilterSelect
        options={languageItems}
        value={languageFilter}
        onChange={onLanguageChange}
        label="Filter by language"
        className="w-36"
      />

      <SearchInput
        placeholder="Search product name…"
        value={search}
        onValueChange={onSearchChange}
        className="w-64"
      />

      <span className="text-muted-foreground ml-auto text-xs">
        {filteredCount === totalCount
          ? `${totalCount} unmatched`
          : `${filteredCount} of ${totalCount} unmatched`}
      </span>
    </div>
  );
}
