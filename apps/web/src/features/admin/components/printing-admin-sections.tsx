import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import type {
  AdminCardDetailResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

import { ShowMoreButton } from "@/components/show-more-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardList } from "@/components/ui/card-list";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidateSpreadsheet } from "@/features/admin/components/candidate-spreadsheet";
import {
  buildSourceLabels,
  useCardDetailData,
} from "@/features/admin/components/card-detail-shared";
import { HistoryRow } from "@/features/admin/components/card-history-section";
import { useAuditEvents } from "@/features/admin/hooks/use-admin-audit";
import {
  useAcceptPrintingField,
  useCheckCandidatePrinting,
  useUncheckCandidatePrinting,
  useUnmapMarketplacePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { PrintingFace } from "@/features/admin/lib/printing-faces";
import { useUserId } from "@/hooks/use-session";

function useFaceCardDetails(faces: readonly PrintingFace[]): AdminCardDetailResponse[] {
  const slugs = [...new Set(faces.map((face) => face.cardSlug))];
  const first = useAdminCardDetail(slugs[0] ?? "").data as AdminCardDetailResponse | undefined;
  const second = useAdminCardDetail(slugs[1] ?? "").data as AdminCardDetailResponse | undefined;
  return [first, second].filter(
    (detail): detail is AdminCardDetailResponse => detail !== undefined,
  );
}

export function PrintingSourcesCard({
  printingId,
  faces,
}: {
  printingId: string;
  faces: readonly PrintingFace[];
}) {
  const details = useFaceCardDetails(faces);
  const invalidates = [
    ...faces.map((face) => adminKeys.cards.detail(face.cardSlug)),
    adminKeys.cards.list,
    adminKeys.printingDesk.all,
  ];
  const { providerSettings, printingSourceFields } = useCardDetailData(invalidates);
  const acceptField = useAcceptPrintingField(invalidates);
  const checkSource = useCheckCandidatePrinting(invalidates);
  const uncheckSource = useUncheckCandidatePrinting(invalidates);

  const sources = [
    ...new Map(
      details
        .flatMap((detail) => detail.candidatePrintings)
        .filter((candidate) => candidate.printingId === printingId)
        .map((candidate): [string, CandidatePrintingResponse] => [candidate.id, candidate]),
    ).values(),
  ];
  const labels = Object.assign(
    {},
    ...details.map((detail) => buildSourceLabels(detail.sources).labels),
  ) as Record<string, string>;
  const names = Object.assign(
    {},
    ...details.map((detail) => buildSourceLabels(detail.sources).names),
  ) as Record<string, string>;
  const activeRow =
    details.flatMap((detail) => detail.printings).find((row) => row.id === printingId) ?? null;
  const fields = printingSourceFields.filter((field) => isPrintingLevelField(field.key));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sources</CardTitle>
        <CardDescription>
          Printing fields from every source linked to this printing. Face fields are reviewed on
          each face&apos;s card page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {details.length === 0 ? (
          <Skeleton className="h-24 w-full" />
        ) : sources.length === 0 ? (
          <p className="text-muted-foreground text-sm">No source is linked to this printing.</p>
        ) : (
          <CandidateSpreadsheet
            fields={fields}
            activeRow={activeRow}
            candidateRows={sources}
            providerLabels={labels}
            providerNames={names}
            providerSettings={providerSettings}
            onCellClick={(field, value) => {
              if (isAcceptPrintingField(field)) {
                acceptField.mutate({ printingId, field, value, source: "provider" });
              }
            }}
            onActiveChange={(field, value) => {
              if (value !== undefined && isAcceptPrintingField(field)) {
                acceptField.mutate({ printingId, field, value });
              }
            }}
            onCheck={(id) => checkSource.mutate(id)}
            onUncheck={(id) => uncheckSource.mutate(id)}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function PrintingMarketplaceCard({
  printingId,
  cardSlug,
}: {
  printingId: string;
  cardSlug: string;
}) {
  const data = useAdminCardDetail(cardSlug).data as AdminCardDetailResponse | undefined;
  const unmap = useUnmapMarketplacePrinting([adminKeys.cards.all, adminKeys.unifiedMappings.all]);
  const mappings = (data?.marketplaceMappings ?? []).filter(
    (mapping) => mapping.targetPrintingId === printingId,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marketplace</CardTitle>
        <CardDescription>
          Listings mapped to this printing. New products are assigned from the card page&apos;s
          queue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data === undefined ? (
          <Skeleton className="h-16 w-full" />
        ) : mappings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No listing is mapped to this printing.</p>
        ) : (
          <CardList>
            {mappings.map((mapping) => (
              <li
                key={`${mapping.marketplace}:${mapping.externalId}:${mapping.finish}:${mapping.variantLanguage ?? ""}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <span className="w-28 shrink-0 font-medium">
                  {marketplaceLabel(mapping.marketplace)}
                </span>
                <span className="min-w-0 flex-1">
                  {mapping.productName}{" "}
                  <span className="text-muted-foreground font-mono">#{mapping.externalId}</span>
                </span>
                <span className="text-muted-foreground">
                  {[mapping.finish, mapping.variantLanguage].filter(Boolean).join(" · ")}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={unmap.isPending}
                  onClick={() =>
                    unmap.mutate({
                      marketplace: mapping.marketplace,
                      printingId,
                      externalId: mapping.externalId,
                      finish: mapping.finish,
                      language: mapping.variantLanguage,
                    })
                  }
                >
                  Unmap
                </Button>
              </li>
            ))}
          </CardList>
        )}
      </CardContent>
    </Card>
  );
}

export function PrintingHistoryCard({ printingId }: { printingId: string }) {
  const userId = useUserId();
  const events = useAuditEvents({ search: printingId });
  const rows = (events.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (event) => event.entityType === "printing" && event.entityId === printingId,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>
          Edits to this printing and its faces. Image uploads are not listed. Times are UTC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.isPending && <Skeleton className="h-16 w-full" />}
        {events.isError && (
          <p className="text-muted-foreground text-sm">The change log could not be loaded.</p>
        )}
        {rows.length > 0 && (
          <CardList>
            {rows.map((event) => (
              <HistoryRow key={event.id} event={event} userId={userId} context={{}} />
            ))}
          </CardList>
        )}
        {!events.isPending && !events.isError && rows.length === 0 && !events.hasNextPage && (
          <p className="text-muted-foreground text-sm">
            Nothing has happened to this printing yet.
          </p>
        )}
        {events.hasNextPage && (
          <ShowMoreButton
            className="mt-0"
            pending={events.isFetchingNextPage}
            onClick={() => void events.fetchNextPage()}
          >
            {events.isFetchingNextPage ? "Looking further back" : "Load more"}
          </ShowMoreButton>
        )}
      </CardContent>
    </Card>
  );
}
