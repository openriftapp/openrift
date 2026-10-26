import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import {
  computeProductSuggestions,
  productSuggestionKey,
} from "@openrift/shared/marketplace-suggestions";
import { formatCents } from "@openrift/shared/money";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type { UnifiedMappingPrintingResponse } from "@openrift/shared/types/api/admin";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { marketplaceCarriesLanguage } from "@openrift/shared/types/pricing";
import type { ListingSku } from "@openrift/shared/workspace-listing-key";
import { parseListingOwnerId } from "@openrift/shared/workspace-listing-key";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductLink } from "@/features/admin/components/price-mappings-utils";
import {
  CM_CONFIG,
  CN_CONFIG,
  CT_CONFIG,
  TCG_CONFIG,
} from "@/features/admin/components/source-configs";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useUnifiedIgnoreProducts,
  useUnifiedIgnoreVariants,
  useUnifiedSaveMappings,
} from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { SourceMappingConfig } from "@/features/admin/lib/price-mappings-types";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { useCards } from "@/features/cards/hooks/use-cards";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { useQueueNavigation } from "@/features/catalog-workspace/hooks/use-queue-navigation";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";

const CONFIG_BY_MARKETPLACE: Record<Marketplace, SourceMappingConfig> = {
  tcgplayer: TCG_CONFIG,
  cardmarket: CM_CONFIG,
  cardtrader: CT_CONFIG,
  cardnexus: CN_CONFIG,
};

const MAX_MATCHES = 8;

interface Candidate {
  printing: UnifiedMappingPrintingResponse;
  score: number | null;
}

export function ListingRecord({ ownerId }: { ownerId: string }) {
  const sku = parseListingOwnerId(ownerId);
  const { data: queue, isPending } = useQuery(workspaceQueueQueryOptions());
  const { data: access, isPending: accessPending } = useAdminAccess();
  const item = queue?.items.find(
    (entry) => entry.owner === "printing" && entry.ownerId === ownerId,
  );

  if (isPending || accessPending) {
    return <Skeleton className="m-4 h-96" />;
  }
  if (sku === null || item === undefined) {
    return (
      <p className="text-muted-foreground p-4">
        This listing is not in the queue any more. It was mapped or ignored.
      </p>
    );
  }
  if (access?.isAdmin !== true) {
    return <p className="text-muted-foreground p-4">Only admins map marketplace listings.</p>;
  }
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <ListingBody key={ownerId} sku={sku} item={item} />
    </Suspense>
  );
}

function ListingBody({ sku, item }: { sku: ListingSku; item: WorkspaceQueueItem }) {
  const navigation = useQueueNavigation("printing");
  const queryClient = useQueryClient();
  const { data: mappingData, isPending: mappingPending } = useQuery({
    ...unifiedMappingsForCardQueryOptions(item.cardSlug ?? ""),
    enabled: item.cardSlug !== null,
  });
  const save = useUnifiedSaveMappings(sku.marketplace);
  const ignoreVariant = useUnifiedIgnoreVariants(sku.marketplace);
  const ignoreProduct = useUnifiedIgnoreProducts(sku.marketplace);
  const pending = save.isPending || ignoreVariant.isPending || ignoreProduct.isPending;

  const group = mappingData?.group ?? null;
  const product =
    group?.[sku.marketplace].stagedProducts.find(
      (entry) =>
        entry.externalId === sku.externalId &&
        entry.finish === sku.finish &&
        entry.language === sku.language,
    ) ?? null;
  const suggestions =
    group === null
      ? []
      : (computeProductSuggestions(group).get(
          productSuggestionKey(sku.marketplace, sku.externalId, sku.finish, sku.language),
        ) ?? []);
  const scoreById = new Map(suggestions.map((entry) => [entry.printingId, entry.score]));
  const candidates: Candidate[] = (group?.printings ?? [])
    .filter((printing) => marketplaceCarriesLanguage(sku.marketplace, printing.language))
    .map((printing) => ({ printing, score: scoreById.get(printing.printingId) ?? null }))
    .toSorted((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const price = product?.lowCents ?? product?.marketCents ?? null;
  const config = CONFIG_BY_MARKETPLACE[sku.marketplace];
  const skuValues = { externalId: sku.externalId, finish: sku.finish, language: sku.language };

  const done = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
      navigation.goNext();
    },
  };
  const assign = (printingId: string) => {
    save.mutate({ mappings: [{ ...skuValues, printingId }] }, done);
  };
  const ignore = () => {
    ignoreVariant.mutate([skuValues], done);
  };
  const ignoreWholeProduct = () => {
    ignoreProduct.mutate([{ externalId: sku.externalId }], done);
  };

  useRegisterRecordActions({
    ignore: pending ? undefined : ignore,
    useSuggestion: (n) => {
      const candidate = candidates[n - 1];
      if (candidate !== undefined && !pending) {
        assign(candidate.printing.printingId);
      }
    },
  });

  return (
    <RecordPane
      header={
        <RecordHeader
          title={product?.productName ?? item.cardName}
          subtitle={[
            marketplaceLabel(sku.marketplace),
            `#${sku.externalId}`,
            sku.finish,
            sku.language,
          ]
            .filter(Boolean)
            .join(" · ")}
          badges={
            <Badge variant="info">
              {item.cardSlug === null ? "Matches no card" : "No printing suggested"}
            </Badge>
          }
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => navigation.skipToEnd()}>
                Skip to end <Kbd>S</Kbd>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="sm" disabled={pending} />}
                >
                  Ignore
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={ignore}>
                    This SKU <Kbd>X</Kbd>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={ignoreWholeProduct}>
                    Every SKU of #{sku.externalId}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
      }
    >
      <RecordSection title="Listing">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>
            <ProductLink config={config} externalId={sku.externalId} language={sku.language}>
              {product?.productName ?? item.cardName}
            </ProductLink>
          </dd>
          {product?.groupName !== undefined && (
            <>
              <dt className="text-muted-foreground">Group</dt>
              <dd>{product.groupName}</dd>
            </>
          )}
          {price !== null && product !== null && (
            <>
              <dt className="text-muted-foreground">Price</dt>
              <dd>{formatCents(price, product.currency)}</dd>
            </>
          )}
        </dl>
      </RecordSection>

      {item.cardSlug !== null && (
        <RecordSection title={`Printings of ${item.cardName}`}>
          {mappingPending ? (
            <Skeleton className="h-24" />
          ) : candidates.length === 0 ? (
            <p className="text-muted-foreground text-sm">No printing carries this language.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {candidates.map((candidate, index) => (
                <li key={candidate.printing.printingId} className="flex items-center gap-2">
                  <span className="font-mono">
                    {formatPrintingCode(candidate.printing.shortCode)}
                  </span>
                  <span className="text-muted-foreground">
                    {[candidate.printing.finish, candidate.printing.language].join(" · ")}
                  </span>
                  {candidate.score !== null && <Badge variant="warning">Suggested</Badge>}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={pending}
                    onClick={() => assign(candidate.printing.printingId)}
                  >
                    Map here {index < 9 && <Kbd>{index + 1}</Kbd>}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </RecordSection>
      )}

      <RecordSection title="Assign to printing…">
        <Suspense fallback={<Skeleton className="h-9" />}>
          <PrintingPicker disabled={pending} onPick={assign} />
        </Suspense>
      </RecordSection>
    </RecordPane>
  );
}

export function PrintingPicker({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (printingId: string) => void;
}) {
  const { allPrintings } = useCards();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const seen = new Set<string>();
  const matches: Printing[] = [];
  if (needle.length >= 3) {
    for (const printing of allPrintings) {
      if (matches.length >= MAX_MATCHES) {
        break;
      }
      if (
        !seen.has(printing.printingId) &&
        (printing.shortCode.toLowerCase().includes(needle) ||
          printing.publicCode.toLowerCase().includes(needle) ||
          printing.card.name.toLowerCase().includes(needle))
      ) {
        seen.add(printing.printingId);
        matches.push(printing);
      }
    }
  }

  return (
    <div className="space-y-2">
      <Input
        aria-label="Printing name or code"
        value={query}
        placeholder="Name or code, e.g. OGN-030"
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.map((printing) => (
        <Button
          key={printing.printingId}
          variant="outline"
          className="w-full justify-start"
          disabled={disabled}
          onClick={() => onPick(printing.printingId)}
        >
          {printing.card.name} · {formatPrintingCode(printing.publicCode)} · {printing.finish} ·{" "}
          {printing.language}
        </Button>
      ))}
    </div>
  );
}
