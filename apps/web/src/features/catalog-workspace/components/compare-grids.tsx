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
import { PrintingSourceColumnActions } from "@/features/admin/components/printing-source-actions";
import { PrintingSourceImageCell } from "@/features/admin/components/printing-source-image-cell";
import {
  acceptCardFieldFn,
  useAcceptPrintingField,
  useCheckCandidateCards,
  useCheckCandidatePrinting,
  useCopyCandidatePrinting,
  useDeleteCandidatePrinting,
  useLinkCandidatePrintings,
  useUncheckCandidatePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useIgnoreCandidatePrinting } from "@/features/admin/hooks/use-ignored-candidates";
import { markFieldAccept, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { IMAGE_FILE_SCOPE } from "@/features/admin/lib/admin-query-keys";
import { getProviderLabel } from "@/features/admin/lib/candidate-rows";
import { PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import { printingPairName } from "@/features/admin/lib/face-rows";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { activeImageSourceUrl, imagesOnSide } from "@/features/admin/lib/printing-side-images";
import { usePrintingFieldAccept } from "@/features/catalog-workspace/hooks/use-suggestion-writes";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { faceCompareCandidates } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import type { PrintingCompareGroup } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { printingCompareGroups } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import {
  cardRecordScope,
  printingRecordScope,
} from "@/features/catalog-workspace/lib/record-scopes";
import { undoScope, usedUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
import { withWriteSignal } from "@/lib/write-signal";

export function CardCompareGrid({
  card,
  sources: allSources,
  fields,
  providerSettings,
  hiddenProviders,
  invalidates,
  isAdmin,
  cardDestination,
}: {
  card: AdminCardResponse;
  sources: CandidateCardResponse[];
  fields: FieldDef<CandidateCardFieldKey>[];
  providerSettings: ProviderSettingResponse[];
  hiddenProviders: ReadonlySet<string>;
  invalidates: readonly (readonly unknown[])[];
  isAdmin: boolean;
  cardDestination: MovedCardDestination;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const checkCandidateCards = useCheckCandidateCards(invalidates);
  const { announce } = useWorkspaceUndo();
  const sources = allSources.filter((source) => !hiddenProviders.has(source.provider));
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
  const scope = printingRecordScope(cardSlugs);
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
      scope={cardRecordScope(cardSlug)}
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
  const fieldAccept = usePrintingFieldAccept(scope, detail.displayName);
  const checkPrintingSource = useCheckCandidatePrinting(scope);
  const uncheckPrintingSource = useUncheckCandidatePrinting(scope);
  const linkSources = useLinkCandidatePrintings(scope);
  const copySource = useCopyCandidatePrinting(scope);
  const deleteSource = useDeleteCandidatePrinting(scope);
  const ignoreSource = useIgnoreCandidatePrinting(scope);
  const targets = [...new Map(detail.printings.map((row) => [row.id, row])).values()].map(
    (row) => ({
      id: row.id,
      label:
        row.otherFace === null
          ? row.expectedPrintingId
          : `${printingPairName(row, detail.displayName)} ${row.expectedPrintingId}`,
    }),
  );

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
            invalidates={IMAGE_FILE_SCOPE}
            runWrite={queueWrite}
          />
        ) : null
      }
      onCellClick={(field, value, candidateId) => {
        if (!isAcceptPrintingField(field)) {
          return;
        }
        const row = candidates.find((candidate) => candidate.id === candidateId);
        const fieldLabel = PRINTING_FIELD_LABELS[field];
        const sourceLabel = row === undefined ? "this source" : getProviderLabel(row, labels);
        const paired = field === "releasedAt" && row !== undefined;
        const mark = markFieldAccept();
        void queueWrite((signal) =>
          fieldAccept.accept(signal, {
            mark,
            input: {
              printingId,
              faceId: face.faceId,
              field,
              value: paired ? { releasedAt: value, releasePrecision: row.releasePrecision } : value,
              source: "provider",
            },
            label: fieldLabel,
            sourceLabel,
            previousValue: paired
              ? { releasedAt: face.releasedAt, releasePrecision: face.releasePrecision }
              : activeRow[field],
          }),
        );
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
      columnActions={
        isAdmin ? (
          <PrintingSourceColumnActions
            targets={targets}
            sourceLabels={labels}
            onAssign={(input) =>
              void queueWrite((signal) => linkSources.mutateAsync(input, { signal }))
            }
            onCopy={(input) =>
              void queueWrite((signal) => copySource.mutateAsync(input, { signal }))
            }
            onIgnore={(input) =>
              void queueWrite((signal) => ignoreSource.mutateAsync(input, { signal }))
            }
            onDelete={(id) => void queueWrite((signal) => deleteSource.mutateAsync(id, { signal }))}
          />
        ) : undefined
      }
    />
  );
}
