import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import { enumLabel } from "@openrift/shared/enum-label";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { computeProductSuggestions } from "@openrift/shared/marketplace-suggestions";
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
import { ProductLink } from "@/features/admin/components/price-mappings-utils";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useUnifiedIgnoreProducts,
  useIgnoreVariantsByMarketplace,
  useUnifiedIgnoreVariants,
  useUnifiedSaveMappings,
} from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { listingPriceCents, SOURCE_CONFIGS } from "@/features/admin/lib/marketplace-sources";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { ListingPrintingCombobox } from "@/features/catalog-workspace/components/listing-record";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  RecordHeader,
  RecordNotice,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import {
  assignedListingUndo,
  ignoredProductUndo,
  ignoredVariantsUndo,
} from "@/features/catalog-workspace/hooks/listing-undo";
import { useQueueNavigation } from "@/features/catalog-workspace/hooks/use-queue-navigation";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { queueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { ListingVariantGroup } from "@/features/catalog-workspace/lib/card-listing-groups";
import { unmatchedListingGroups } from "@/features/catalog-workspace/lib/card-listing-groups";
import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";
import { listingAssignment } from "@/features/catalog-workspace/lib/card-listing-rows";
import { listingVariantsText } from "@/features/catalog-workspace/lib/owner-items";
import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import { combinedUndo, ignoredUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
import { useEnumOrders } from "@/hooks/use-enums";
import { formatCentsInLocale } from "@/lib/format";
import { runReportedMutation } from "@/lib/run-reported-mutation";

type IgnoreVariants = ReturnType<typeof useIgnoreVariantsByMarketplace>;

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
): Promise<{
  ignored: { marketplace: AdminMarketplaceName; rows: CardListingRow[] }[];
  complete: boolean;
}> {
  const byMarketplace = Map.groupBy(group.rows, (row) => row.marketplace);
  const runs = await Promise.all(
    [...byMarketplace].map(async ([marketplace, rows]) => {
      const ok = await runReportedMutation(() =>
        ignores[marketplace].mutateAsync(rows.map((row) => skuOf(row))),
      );
      return ok ? { marketplace, rows } : null;
    }),
  );
  const ignored = runs.filter((run) => run !== null);
  return { ignored, complete: ignored.length === runs.length };
}

function groupIgnoreUndo(
  ignored: readonly { marketplace: AdminMarketplaceName; rows: CardListingRow[] }[],
  what: string,
  record: string,
) {
  return combinedUndo(
    ignoredUndoText({ what, record }),
    ignored.map(({ marketplace, rows }) =>
      ignoredVariantsUndo(
        marketplace,
        rows.map((row) => skuOf(row)),
        record,
      ),
    ),
  );
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
      <RecordNotice>
        These listings are not in the queue any more. They were mapped or ignored.
      </RecordNotice>
    );
  }
  if (access?.isAdmin !== true) {
    return <RecordNotice>Only admins map marketplace listings.</RecordNotice>;
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
  const ignores = useIgnoreVariantsByMarketplace();
  const ignoring = Object.values(ignores).some((mutation) => mutation.isPending);
  const { announce } = useWorkspaceUndo();

  const variants = item.variants ?? [];
  const mapping = data?.group ?? null;
  const groups =
    mapping === null
      ? []
      : unmatchedListingGroups(mapping, computeProductSuggestions(mapping), variants);

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
  const ignoreGroup = async (group: ListingVariantGroup, what: string) => {
    const last = groups.length === 1;
    const { ignored, complete } = await ignoreVariantGroup(group, ignores);
    if (ignored.length === 0) {
      return;
    }
    announce(groupIgnoreUndo(ignored, what, item.cardName));
    await refresh();
    if (last && complete) {
      navigation.goNext();
    }
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
          const variantName = [group.language ?? "Language not listed", finish].join(" · ");
          return (
            <RecordSection
              key={group.key}
              title={variantName}
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
                    onClick={() =>
                      void queueWorkspaceWrite(() =>
                        ignoreGroup(group, `the ${variantName} variant`),
                      )
                    }
                  >
                    Ignore variant
                  </Button>
                </>
              }
            >
              <ul className="flex flex-col">
                {group.rows.map((row) => (
                  <ListingLine
                    key={row.key}
                    row={row}
                    record={item.cardName}
                    onDone={refresh}
                    disabled={ignoring}
                  />
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
  record,
  disabled,
  onDone,
}: {
  row: CardListingRow;
  record: string;
  disabled: boolean;
  onDone: () => Promise<void>;
}) {
  const { marketplace, product } = row;
  const save = useUnifiedSaveMappings(marketplace);
  const ignoreVariant = useUnifiedIgnoreVariants(marketplace);
  const ignoreProduct = useUnifiedIgnoreProducts(marketplace);
  const [assigning, setAssigning] = useState(false);
  const pending = disabled || save.isPending || ignoreVariant.isPending || ignoreProduct.isPending;
  const price = listingPriceCents(marketplace, product);
  const { announce } = useWorkspaceUndo();
  const finish = async (run: () => Promise<unknown>, entry: WorkspaceUndoEntry) => {
    if (await runReportedMutation(run)) {
      announce(entry);
      await onDone();
    }
  };
  const assign = async (printingId: string) => {
    let result: Awaited<ReturnType<typeof save.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      result = await save.mutateAsync({ mappings: [listingAssignment(row, printingId)] });
    });
    if (ok && result && result.skipped.length === 0) {
      announce(assignedListingUndo(marketplace, skuOf(row), printingId, record));
    }
    if (ok) {
      await onDone();
    }
  };

  return (
    <li className="flex flex-col gap-2 border-t py-1.5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{marketplaceLabel(marketplace)}</Badge>
        <span className="min-w-0 flex-1 break-words">
          <ProductLink
            config={SOURCE_CONFIGS[marketplace]}
            externalId={product.externalId}
            language={product.language}
          >
            {product.productName}
          </ProductLink>
        </span>
        {price !== null && (
          <span className="text-sm tabular-nums">
            {formatCentsInLocale(price, product.currency)}
          </span>
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
            <DropdownMenuItem
              onClick={() =>
                void queueWorkspaceWrite(() =>
                  finish(
                    () => ignoreVariant.mutateAsync([skuOf(row)]),
                    ignoredVariantsUndo(marketplace, [skuOf(row)], record),
                  ),
                )
              }
            >
              <BanIcon />
              Ignore this SKU
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                void queueWorkspaceWrite(() =>
                  finish(
                    () => ignoreProduct.mutateAsync([{ externalId: product.externalId }]),
                    ignoredProductUndo(marketplace, product.externalId, record),
                  ),
                )
              }
            >
              <BanIcon />
              Ignore every SKU of #{product.externalId}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {assigning && (
        <Suspense fallback={<Skeleton className="h-9" />}>
          <ListingPrintingCombobox
            disabled={pending}
            onPick={(printingId) => void queueWorkspaceWrite(() => assign(printingId))}
          />
        </Suspense>
      )}
    </li>
  );
}
