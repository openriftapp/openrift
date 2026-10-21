import { getOrientation } from "@openrift/shared/card-orientation";
import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type {
  AdminCardDetailResponse,
  AdminCardResponse,
  CandidateCardResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import { Suspense } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CandidateCardFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";
import { CandidateSpreadsheet } from "@/features/admin/components/candidate-spreadsheet";
import {
  buildPrintingNormalizer,
  buildSourceLabels,
  useCardDetailData,
} from "@/features/admin/components/card-detail-shared";
import { CardFieldsSection } from "@/features/admin/components/card-fields-section";
import { PrintingSourceImageCell } from "@/features/admin/components/printing-source-image-cell";
import {
  useAcceptPrintingField,
  useCheckCandidateCard,
  useCheckCandidatePrinting,
  useUncheckCandidatePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { toastFieldAccepted } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { getProviderLabel } from "@/features/admin/lib/candidate-rows";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";
import type { PrintingCompareGroup } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { printingCompareGroups } from "@/features/catalog-workspace/lib/printing-suggestion-rows";

export function CompareSourcesDialog({
  open,
  onOpenChange,
  card,
  sources,
  fields,
  providerSettings,
  invalidates,
  isAdmin,
  focusField,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: AdminCardResponse;
  sources: CandidateCardResponse[];
  fields: FieldDef<CandidateCardFieldKey>[];
  providerSettings: ProviderSettingResponse[];
  invalidates: readonly (readonly unknown[])[];
  isAdmin: boolean;
  focusField?: string;
}) {
  const checkCandidateCard = useCheckCandidateCard(invalidates);
  const openSourceIds = sources
    .filter((source) => source.provider !== USER_SUBMISSION_PROVIDER && source.checkedAt === null)
    .map((source) => source.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Compare all sources</DialogTitle>
        </DialogHeader>
        <CardFieldsSection
          card={card}
          sources={sources}
          candidateCardFields={fields}
          providerSettings={providerSettings}
          onCheckAllSources={() => {
            for (const id of openSourceIds) {
              checkCandidateCard.mutate(id);
            }
          }}
          isCheckingAllSources={checkCandidateCard.isPending}
          invalidates={invalidates}
          isAdmin={isAdmin}
          focusField={focusField}
        />
      </DialogContent>
    </Dialog>
  );
}

interface PrintingSourcesProps {
  printingId: string;
  cardSlugs: readonly string[];
  details: readonly AdminCardDetailResponse[];
  providerSettings: ProviderSettingResponse[];
  hiddenProviders: ReadonlySet<string>;
  costKeywords: readonly string[];
  isAdmin: boolean;
}

export function PrintingCompareSourcesDialog({
  open,
  onOpenChange,
  ...props
}: PrintingSourcesProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Compare all sources</DialogTitle>
        </DialogHeader>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <PrintingSources {...props} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function PrintingSources({
  printingId,
  cardSlugs,
  details,
  providerSettings,
  hiddenProviders,
  costKeywords,
  isAdmin,
}: PrintingSourcesProps) {
  const scope = [
    ...cardSlugs.map((slug) => adminKeys.cards.detail(slug)),
    adminKeys.workspace,
    adminKeys.printingDesk.all,
  ];
  const { printingSourceFields } = useCardDetailData(scope);
  const acceptPrintingField = useAcceptPrintingField(scope);
  const checkPrintingSource = useCheckCandidatePrinting(scope);
  const uncheckPrintingSource = useUncheckCandidatePrinting(scope);
  const groups = printingCompareGroups(details, printingId, hiddenProviders);

  if (groups.every((group) => group.candidates.length === 0)) {
    return <p className="text-muted-foreground py-4">No source lists this printing.</p>;
  }

  function spreadsheet({ detail, face, candidates }: PrintingCompareGroup) {
    const { labels, names, submitters } = buildSourceLabels(detail.sources, detail.displayName);
    const sideImages = imagesOnSide(
      detail.printingImages.filter((image) => image.printingId === printingId),
      face,
    );
    const ownUrls = new Set(sideImages.map((image) => image.originalUrl));
    const activeRow = {
      ...face,
      imageUrl: sideImages.find((image) => image.isActive)?.originalUrl ?? null,
    };
    const landscape = getOrientation(detail.card?.types ?? []) === "landscape";
    return (
      <CandidateSpreadsheet
        key={candidates.map((row) => row.id).join(",")}
        fields={printingSourceFields}
        activeRow={activeRow}
        candidateRows={candidates}
        providerLabels={labels}
        providerNames={names}
        submitters={submitters}
        providerSettings={providerSettings}
        activeImageUrl={activeRow.imageUrl}
        costKeywords={costKeywords}
        normalizeCandidate={buildPrintingNormalizer(detail.setTotals, face.setSlug, costKeywords)}
        renderCandidateCell={(field, row) =>
          field.key === "imageUrl" && typeof row.imageUrl === "string" ? (
            <PrintingSourceImageCell
              candidatePrintingId={row.id}
              url={row.imageUrl}
              sourceLabel={labels[row.candidateCardId] ?? "Source"}
              isUsed={ownUrls.has(row.imageUrl)}
              landscape={landscape}
            />
          ) : null
        }
        onCellClick={(field, value, candidateId) => {
          if (!isAcceptPrintingField(field)) {
            return;
          }
          const previousValue = activeRow[field];
          acceptPrintingField.mutate({
            printingId,
            faceId: face.faceId,
            field,
            value,
            source: "provider",
          });
          const row = candidates.find((candidate) => candidate.id === candidateId);
          toastFieldAccepted({
            fieldLabel: printingSourceFields.find((entry) => entry.key === field)?.label ?? field,
            sourceLabel: row === undefined ? "this source" : getProviderLabel(row, labels),
            previousValue,
            onUndo: (previous) =>
              acceptPrintingField.mutate({
                printingId,
                faceId: face.faceId,
                field,
                value: previous,
                source: "manual",
              }),
          });
        }}
        onActiveChange={(field, value) => {
          if (value === undefined || !isAcceptPrintingField(field)) {
            return;
          }
          acceptPrintingField.mutate({ printingId, faceId: face.faceId, field, value });
        }}
        onCheck={isAdmin ? (id) => checkPrintingSource.mutate(id) : undefined}
        onUncheck={isAdmin ? (id) => uncheckPrintingSource.mutate(id) : undefined}
      />
    );
  }

  if (groups.length === 1 && groups[0] !== undefined) {
    return spreadsheet(groups[0]);
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.face.faceId} className="space-y-2">
          <h3 className="font-medium">
            {group.face.side === 2 ? "Back" : "Front"} · {formatPrintingCode(group.face.publicCode)}
          </h3>
          {group.candidates.length === 0 ? (
            <p className="text-muted-foreground">No source lists this face.</p>
          ) : (
            spreadsheet(group)
          )}
        </section>
      ))}
    </div>
  );
}
