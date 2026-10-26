import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import { enumLabel } from "@openrift/shared/enum-label";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { computeProductSuggestions } from "@openrift/shared/marketplace-suggestions";
import { formatCents } from "@openrift/shared/money";
import type { AdminMarketplaceName } from "@openrift/shared/types/api/admin";
import { parseListingCardOwnerId } from "@openrift/shared/workspace-listing-key";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BanIcon, EllipsisVerticalIcon, LinkIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { MARKETPLACE_CONFIGS } from "@/features/admin/components/marketplace-product-entries";
import { ProductLink } from "@/features/admin/components/price-mappings-utils";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useUnifiedIgnoreProducts,
  useUnifiedIgnoreVariants,
  useUnifiedSaveMappings,
} from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { PrintingPicker } from "@/features/catalog-workspace/components/listing-record";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useQueueNavigation } from "@/features/catalog-workspace/hooks/use-queue-navigation";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type { ListingVariantGroup } from "@/features/catalog-workspace/lib/card-listing-groups";
import { unmatchedListingGroups } from "@/features/catalog-workspace/lib/card-listing-groups";
import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";
import { listingAssignment } from "@/features/catalog-workspace/lib/card-listing-rows";
import { listingVariantsText } from "@/features/catalog-workspace/lib/owner-items";
import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import { useEnumOrders } from "@/hooks/use-enums";

type IgnoreVariants = Record<AdminMarketplaceName, ReturnType<typeof useUnifiedIgnoreVariants>>;

function skuOf(row: CardListingRow) {
  return {
    externalId: row.product.externalId,
    finish: row.product.finish,
    language: row.product.language,
  };
}

async function ignoreVariantGroup(
  group: ListingVariantGroup,
  ignores: IgnoreVariants,
  onDone: () => Promise<void>,
): Promise<void> {
  const byMarketplace = Map.groupBy(group.rows, (row) => row.marketplace);
  const runs = [...byMarketplace].map(([marketplace, rows]) =>
    ignores[marketplace].mutateAsync(rows.map((row) => skuOf(row))),
  );
  const ok = await Promise.all(runs).then(
    () => true,
    () => false,
  );
  if (ok) {
    await onDone();
  }
}

export function CardListingsRecord({ ownerId }: { ownerId: string }) {
  const cardSlug = parseListingCardOwnerId(ownerId);
  const { data: queue, isPending } = useQuery(workspaceQueueQueryOptions());
  const { data: access, isPending: accessPending } = useAdminAccess();
  const item = queue?.items.find(
    (entry) => entry.owner === "printing" && entry.ownerId === ownerId,
  );

  if (isPending || accessPending) {
    return <Skeleton className="m-4 h-96" />;
  }
  if (cardSlug === null || item === undefined) {
    return (
      <p className="text-muted-foreground p-4">
        These listings are not in the queue any more. They were mapped or ignored.
      </p>
    );
  }
  if (access?.isAdmin !== true) {
    return <p className="text-muted-foreground p-4">Only admins map marketplace listings.</p>;
  }
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <CardListingsBody key={ownerId} cardSlug={cardSlug} item={item} />
    </Suspense>
  );
}

function CardListingsBody({ cardSlug, item }: { cardSlug: string; item: WorkspaceQueueItem }) {
  const navigation = useQueueNavigation("printing");
  const queryClient = useQueryClient();
  const { labels } = useEnumOrders();
  const { data, isPending, isError } = useQuery(unifiedMappingsForCardQueryOptions(cardSlug));
  const ignores: IgnoreVariants = {
    tcgplayer: useUnifiedIgnoreVariants("tcgplayer"),
    cardmarket: useUnifiedIgnoreVariants("cardmarket"),
    cardtrader: useUnifiedIgnoreVariants("cardtrader"),
    cardnexus: useUnifiedIgnoreVariants("cardnexus"),
  };
  const ignoring = Object.values(ignores).some((mutation) => mutation.isPending);

  const variants = item.variants ?? [];
  const mapping = data?.group ?? null;
  const groups =
    mapping === null
      ? []
      : unmatchedListingGroups(mapping, computeProductSuggestions(mapping), variants);

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
  const ignoreGroup = (group: ListingVariantGroup) => {
    const last = groups.length === 1;
    void ignoreVariantGroup(group, ignores, async () => {
      await refresh();
      if (last) {
        navigation.goNext();
      }
    });
  };

  useRegisterRecordActions({});

  return (
    <RecordPane
      header={
        <RecordHeader
          title={item.cardName}
          subtitle={listingVariantsText(variants)}
          badges={<Badge variant="info">No printing for these listings</Badge>}
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigation.skipToEnd()}>
              Skip to end <Kbd>S</Kbd>
            </Button>
          }
        />
      }
    >
      {isPending ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <p className="text-muted-foreground">The listings could not be loaded.</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">
          These listings are mapped or ignored now. The queue updates on the next refresh.
        </p>
      ) : (
        groups.map((group) => {
          const finish = enumLabel(labels.finishes, group.finish);
          return (
            <RecordSection
              key={group.key}
              title={[group.language ?? "Language not listed", finish].join(" · ")}
              actions={
                <>
                  <Link
                    to="/admin/workspace/printings/create"
                    search={{
                      card: cardSlug,
                      language: group.language ?? undefined,
                      finish: group.finish,
                    }}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Create printing
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ignoring}
                    onClick={() => ignoreGroup(group)}
                  >
                    Ignore variant
                  </Button>
                </>
              }
            >
              <ul className="flex flex-col">
                {group.rows.map((row) => (
                  <ListingLine key={row.key} row={row} onDone={refresh} disabled={ignoring} />
                ))}
              </ul>
            </RecordSection>
          );
        })
      )}
    </RecordPane>
  );
}

function ListingLine({
  row,
  disabled,
  onDone,
}: {
  row: CardListingRow;
  disabled: boolean;
  onDone: () => Promise<void>;
}) {
  const { marketplace, product } = row;
  const save = useUnifiedSaveMappings(marketplace);
  const ignoreVariant = useUnifiedIgnoreVariants(marketplace);
  const ignoreProduct = useUnifiedIgnoreProducts(marketplace);
  const [assigning, setAssigning] = useState(false);
  const pending = disabled || save.isPending || ignoreVariant.isPending || ignoreProduct.isPending;
  const price = product.lowCents ?? product.marketCents;
  const done = { onSuccess: onDone };

  return (
    <li className="flex flex-col gap-2 border-t py-1.5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{marketplaceLabel(marketplace)}</Badge>
        <span className="min-w-0 flex-1 break-words">
          <ProductLink
            config={MARKETPLACE_CONFIGS[marketplace]}
            externalId={product.externalId}
            language={product.language}
          >
            {product.productName}
          </ProductLink>
        </span>
        {price !== null && (
          <span className="text-sm tabular-nums">{formatCents(price, product.currency)}</span>
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
            <DropdownMenuItem onClick={() => setAssigning(!assigning)}>
              <LinkIcon />
              Assign to printing…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => ignoreVariant.mutate([skuOf(row)], done)}>
              <BanIcon />
              Ignore this SKU
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => ignoreProduct.mutate([{ externalId: product.externalId }], done)}
            >
              <BanIcon />
              Ignore every SKU of #{product.externalId}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {assigning && (
        <Suspense fallback={<Skeleton className="h-9" />}>
          <PrintingPicker
            disabled={pending}
            onPick={(printingId) =>
              save.mutate({ mappings: [listingAssignment(row, printingId)] }, done)
            }
          />
        </Suspense>
      )}
    </li>
  );
}
