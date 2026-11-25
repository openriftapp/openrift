import { getOrientation } from "@openrift/shared/card-orientation";
import {
  isAcceptPrintingField,
  REQUIRED_PRINTING_FIELD_KEYS,
} from "@openrift/shared/contracts/admin/card-mutations";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import type {
  AdminCardDetailResponse,
  AdminCardResponse,
  CandidateCardResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import { Suspense } from "react";

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
import type { MovedCardDestination } from "@/features/admin/components/move-submission-dialog";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { PrintingSourceImageCell } from "@/features/admin/components/printing-source-image-cell";
import {
  acceptCardFieldFn,
  acceptPrintingFieldFn,
  useAcceptPrintingField,
  useCheckCandidateCards,
  useCheckCandidatePrinting,
  useUncheckCandidatePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { acceptFieldWithUndo, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { getProviderLabel } from "@/features/admin/lib/candidate-rows";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { activeImageSourceUrl, imagesOnSide } from "@/features/admin/lib/printing-side-images";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { faceCompareCandidates } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import type { PrintingCompareGroup } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { printingCompareGroups } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { undoScope, usedUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
import { withSignal, withWriteSignal } from "@/lib/write-signal";

export function CardCompareGrid({
  card,
  sources,
  fields,
  providerSettings,
  invalidates,
  isAdmin,
  cardDestination,
}: {
  card: AdminCardResponse;
  sources: CandidateCardResponse[];
  fields: FieldDef<CandidateCardFieldKey>[];
  providerSettings: ProviderSettingResponse[];
  invalidates: readonly (readonly unknown[])[];
  isAdmin: boolean;
  cardDestination: MovedCardDestination;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const checkCandidateCards = useCheckCandidateCards(invalidates);
  const { announce } = useWorkspaceUndo();
  const openSourceIds = sources
    .filter((source) => source.provider !== USER_SUBMISSION_PROVIDER && source.checkedAt === null)
    .map((source) => source.id);

  return (
    <CardFieldsSection
      hideHeading
      agreedFieldsOpenByDefault
      checkableCount={openSourceIds.length}
      card={card}
      sources={sources}
      candidateCardFields={fields}
      providerSettings={providerSettings}
      onCheckAllSources={() => {
        if (openSourceIds.length > 0) {
          void queueWrite((signal) =>
            checkCandidateCards.mutateAsync(
              { cardId: card.id, candidateCardIds: openSourceIds },
              { signal },
            ),
          );
        }
      }}
      isCheckingAllSources={checkCandidateCards.isPending}
      invalidates={invalidates}
      isAdmin={isAdmin}
      runWrite={queueWrite}
      cardDestination={cardDestination}
      onFieldAccepted={({ fieldLabel, sourceLabel, revert }) =>
        announce({
          ...usedUndoText({ field: fieldLabel, source: sourceLabel, record: card.name }),
          invalidates: undoScope(invalidates),
          undo: (signal) =>
            revertAcceptedField(revert, (data) =>
              withWriteSignal(signal, () => acceptCardFieldFn({ data, signal })),
            ),
        })
      }
    />
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

export function PrintingCompareGrid(props: PrintingSourcesProps) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PrintingSources {...props} />
    </Suspense>
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
  const groups = printingCompareGroups(details, printingId, hiddenProviders);

  if (groups.every((group) => group.candidates.length === 0)) {
    return <p className="text-muted-foreground py-4">No source lists this printing.</p>;
  }

  const spreadsheet = (group: PrintingCompareGroup) => (
    <SourceSpreadsheet
      key={group.candidates.map((row) => row.id).join(",")}
      group={group}
      printingId={printingId}
      scope={scope}
      providerSettings={providerSettings}
      costKeywords={costKeywords}
      isAdmin={isAdmin}
      level="printing"
    />
  );

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

interface FaceSourcesProps {
  cardSlug: string;
  faceId: string;
  detail: AdminCardDetailResponse;
  providerSettings: ProviderSettingResponse[];
  hiddenProviders: ReadonlySet<string>;
  costKeywords: readonly string[];
  isAdmin: boolean;
}

export function FaceCompareGrid(props: FaceSourcesProps) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <FaceSources {...props} />
    </Suspense>
  );
}

function FaceSources({
  cardSlug,
  faceId,
  detail,
  providerSettings,
  hiddenProviders,
  costKeywords,
  isAdmin,
}: FaceSourcesProps) {
  const face = detail.printings.find((printing) => printing.faceId === faceId);
  const candidates = faceCompareCandidates(detail, faceId, hiddenProviders);

  if (face === undefined || candidates.length === 0) {
    return <p className="text-muted-foreground py-4">No source lists this face.</p>;
  }
  return (
    <SourceSpreadsheet
      group={{ detail, face, candidates }}
      printingId={face.id}
      scope={[adminKeys.cards.detail(cardSlug), adminKeys.workspace, adminKeys.printingDesk.all]}
      providerSettings={providerSettings}
      costKeywords={costKeywords}
      isAdmin={isAdmin}
      level="face"
    />
  );
}

function SourceSpreadsheet({
  group: { detail, face, candidates },
  printingId,
  scope,
  providerSettings,
  costKeywords,
  isAdmin,
  level,
}: {
  group: PrintingCompareGroup;
  printingId: string;
  scope: readonly (readonly unknown[])[];
  providerSettings: ProviderSettingResponse[];
  costKeywords: readonly string[];
  isAdmin: boolean;
  level: "face" | "printing";
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const { printingSourceFields } = useCardDetailData(scope);
  const acceptPrintingField = useAcceptPrintingField(scope);
  const checkPrintingSource = useCheckCandidatePrinting(scope);
  const uncheckPrintingSource = useUncheckCandidatePrinting(scope);
  const { announce } = useWorkspaceUndo();

  const fields = printingSourceFields.filter(
    (field) => isPrintingLevelField(field.key) === (level === "printing"),
  );
  const { labels, names, submitters } = buildSourceLabels(detail.sources, detail.displayName);
  const sideImages = imagesOnSide(
    detail.printingImages.filter((image) => image.printingId === printingId),
    face,
  );
  const ownUrls = new Set(sideImages.map((image) => image.originalUrl));
  const storedByOriginal = new Map(
    sideImages.map((image) => [image.originalUrl, printingImageDisplayUrl(image)]),
  );
  const mainImage = sideImages.find((image) => image.isActive);
  const activeRow = {
    ...face,
    imageUrl: activeImageSourceUrl(sideImages),
  };
  const landscape = getOrientation(detail.card?.types ?? []) === "landscape";
  return (
    <CandidateSpreadsheet
      fields={fields}
      requiredKeys={REQUIRED_PRINTING_FIELD_KEYS}
      activeRow={activeRow}
      candidateRows={candidates}
      providerLabels={labels}
      providerNames={names}
      submitters={submitters}
      providerSettings={providerSettings}
      activeImageUrl={activeRow.imageUrl}
      costKeywords={costKeywords}
      normalizeCandidate={buildPrintingNormalizer(detail.setTotals, face.setSlug, costKeywords)}
      renderActiveCell={(field) =>
        field.key === "imageUrl" && mainImage !== undefined ? (
          <PrintingImageBox
            url={printingImageDisplayUrl(mainImage)}
            alt="Current image"
            landscape={landscape}
          />
        ) : undefined
      }
      renderCandidateCell={(field, row) =>
        field.key === "imageUrl" && typeof row.imageUrl === "string" ? (
          <PrintingSourceImageCell
            candidatePrintingId={row.id}
            url={storedByOriginal.get(row.imageUrl) ?? row.imageUrl}
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
        const row = candidates.find((candidate) => candidate.id === candidateId);
        const fieldLabel = fields.find((entry) => entry.key === field)?.label ?? field;
        const sourceLabel = row === undefined ? "this source" : getProviderLabel(row, labels);
        void queueWrite((signal) => {
          const accept = withSignal(acceptPrintingField.mutateAsync, signal);
          return acceptFieldWithUndo({
            accept,
            input: { printingId, faceId: face.faceId, field, value, source: "provider" },
            fieldLabel,
            sourceLabel,
            previousValue: activeRow[field],
            onAccepted: (revert) =>
              announce({
                ...usedUndoText({
                  field: fieldLabel,
                  source: sourceLabel,
                  record: detail.displayName,
                }),
                invalidates: undoScope(scope),
                undo: (undoSignal) =>
                  revertAcceptedField(revert, (data) =>
                    withWriteSignal(undoSignal, () =>
                      acceptPrintingFieldFn({ data, signal: undoSignal }),
                    ),
                  ),
              }),
          });
        });
      }}
      onActiveChange={(field, value) => {
        if (value === undefined || !isAcceptPrintingField(field)) {
          return;
        }
        void queueWrite((signal) =>
          acceptPrintingField.mutateAsync(
            { printingId, faceId: face.faceId, field, value },
            { signal },
          ),
        );
      }}
      onCheck={
        isAdmin
          ? (id) => void queueWrite((signal) => checkPrintingSource.mutateAsync(id, { signal }))
          : undefined
      }
      onUncheck={
        isAdmin
          ? (id) => void queueWrite((signal) => uncheckPrintingSource.mutateAsync(id, { signal }))
          : undefined
      }
    />
  );
}
