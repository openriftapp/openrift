import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { labelMap } from "@openrift/shared/enum-label";

import {
  acceptPrintingFieldFn,
  uncheckCandidatePrintingsFn,
  useAcceptPrintingField,
  useCheckAllCandidatePrintings,
  useCheckCandidatePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useSetCandidatePrintingImage } from "@/features/admin/hooks/use-admin-image-mutations";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import { acceptFieldWithUndo, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import {
  queuedWorkspaceWrite,
  useQueueWorkspaceWrite,
} from "@/features/catalog-workspace/hooks/workspace-writes";
import type {
  FaceSuggestionModel,
  PrintingFieldSuggestion,
  SourceImageCandidate,
  SuggestionSource,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { primaryLabel } from "@/features/catalog-workspace/lib/suggestion-labels";
import type {
  QueryScope,
  WorkspaceUndoEntry,
} from "@/features/catalog-workspace/lib/workspace-undo";
import {
  discardUndoText,
  undoScope,
  usedUndoText,
} from "@/features/catalog-workspace/lib/workspace-undo";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withSignal, withWriteSignal } from "@/lib/write-signal";

export function useValueLabels(): PrintingValueLabels {
  const { labels } = useEnumOrders();
  const languages = useLanguageLabels();
  const { data: markerData } = useMarkers();
  const { data: channelData } = useDistributionChannels();
  return {
    rarities: labels.rarities,
    finishes: labels.finishes,
    artVariants: labels.artVariants,
    cardSizes: labels.cardSizes,
    languages,
    markers: labelMap(markerData.markers),
    channels: labelMap(
      [...buildChannelBreadcrumbsBySlug(channelData.distributionChannels)].map(([slug, label]) => ({
        slug,
        label,
      })),
    ),
  };
}

function discardText(
  sources: readonly SuggestionSource[],
  ids: readonly string[],
  imageIds: ReadonlySet<string> | null,
  record: string,
) {
  const picked = sources.filter((source) => ids.includes(source.candidatePrintingId));
  const images = picked.filter((source) => imageIds?.has(source.candidatePrintingId)).length;
  const differences = picked.reduce((sum, source) => sum + source.differences, 0);
  return discardUndoText({
    suggestions: differences - images,
    images,
    sources: picked.length,
    record,
  });
}

export function useCandidateDiscards({
  scope,
  sources,
  imageIds,
  record,
}: {
  scope: QueryScope;
  sources: readonly SuggestionSource[];
  imageIds?: ReadonlySet<string>;
  record: string;
}) {
  const checkCandidate = useCheckCandidatePrinting(scope);
  const checkAll = useCheckAllCandidatePrintings(scope);
  const { announce, push } = useWorkspaceUndo();

  function entryFor(ids: readonly string[]): WorkspaceUndoEntry {
    return {
      ...discardText(sources, ids, imageIds ?? null, record),
      invalidates: undoScope(scope),
      undo: async (signal) => {
        await withWriteSignal(signal, () =>
          uncheckCandidatePrintingsFn({ data: { candidatePrintingIds: [...ids] }, signal }),
        );
      },
    };
  }

  async function discard(signal: AbortSignal, candidatePrintingId: string): Promise<void> {
    const entry = entryFor([candidatePrintingId]);
    const ok = await runReportedMutation(() =>
      checkCandidate.mutateAsync(candidatePrintingId, { signal }),
    );
    if (ok) {
      announce(entry);
    }
  }

  async function discardAll(signal: AbortSignal, ids: readonly string[]) {
    if (ids.length === 0) {
      return;
    }
    const entry = entryFor(ids);
    await checkAll.mutateAsync({ extraIds: [...ids] }, { signal });
    push(entry);
  }

  return {
    discard,
    discardAll,
    pending: checkCandidate.isPending || checkAll.isPending,
  };
}

export type FaceChip =
  | { kind: "image"; key: string; image: SourceImageCandidate }
  | { kind: "field"; key: string; suggestion: PrintingFieldSuggestion };

export function faceChips(model: FaceSuggestionModel): FaceChip[] {
  return [
    ...model.sourceImages.map((image): FaceChip => ({
      kind: "image",
      key: `image:${image.candidate.id}`,
      image,
    })),
    ...model.suggestions.map((suggestion): FaceChip => ({
      kind: "field",
      key: suggestion.key,
      suggestion,
    })),
  ];
}

export function useFaceRecordActions({
  cardSlug,
  record,
  model,
  canCheck,
  enabled,
  loading = false,
}: {
  cardSlug: string;
  record: string;
  model: FaceSuggestionModel | null;
  canCheck: boolean;
  enabled: boolean;
  loading?: boolean;
}) {
  const scope = [adminKeys.cards.detail(cardSlug), adminKeys.cards.list, adminKeys.workspace];
  const acceptField = useAcceptPrintingField(scope);
  const discards = useCandidateDiscards({
    scope,
    sources: model?.sources ?? [],
    imageIds: new Set(model?.sourceImages.map((image) => image.candidate.id)),
    record,
  });
  const { announce } = useWorkspaceUndo();
  const queue = useQueueWorkspaceWrite();
  const setCandidateImage = useSetCandidatePrintingImage(scope);
  const acceptSubmission = useAcceptSubmission({ cardSlug });

  const chips = enabled && model !== null ? faceChips(model) : [];
  const enterIds = enabled && canCheck && model !== null ? model.enterCandidateIds : [];
  const contributorOpen =
    enabled &&
    model !== null &&
    model.sources.some((source) => source.isContributor && source.differences > 0);
  const pending =
    acceptField.isPending ||
    discards.pending ||
    setCandidateImage.isPending ||
    acceptSubmission.isPending;

  async function applyField(
    signal: AbortSignal,
    suggestion: PrintingFieldSuggestion,
  ): Promise<void> {
    if (!isAcceptPrintingField(suggestion.field)) {
      return;
    }
    const field = suggestion.field;
    if (suggestion.isContributor) {
      await runReportedMutation(() =>
        acceptSubmission.mutateAsync(
          {
            candidateCardId: suggestion.candidate.candidateCardId,
            printingFields: [
              {
                printingId: suggestion.printingId,
                faceId: suggestion.faceId,
                field,
                value: suggestion.proposed,
                source: "provider",
              },
            ],
          },
          { signal },
        ),
      );
      return;
    }
    const accept = withSignal(acceptField.mutateAsync, signal);
    await acceptFieldWithUndo({
      accept,
      input: {
        printingId: suggestion.printingId,
        faceId: suggestion.faceId,
        field,
        value: suggestion.proposed,
        source: "provider",
      },
      fieldLabel: suggestion.label,
      sourceLabel: suggestion.provider,
      previousValue: suggestion.current,
      onAccepted: (revert) =>
        announce({
          ...usedUndoText({ field: suggestion.label, source: suggestion.provider, record }),
          invalidates: undoScope(scope),
          undo: (undoSignal) =>
            revertAcceptedField(revert, (data) =>
              withWriteSignal(undoSignal, () =>
                acceptPrintingFieldFn({ data, signal: undoSignal }),
              ),
            ),
        }),
    });
  }

  async function applyImage(signal: AbortSignal, image: SourceImageCandidate): Promise<void> {
    if (image.isContributor) {
      if (model?.face) {
        const face = model.face;
        await runReportedMutation(() =>
          acceptSubmission.mutateAsync(
            {
              candidateCardId: image.candidate.candidateCardId,
              images: [
                {
                  candidatePrintingId: image.candidate.id,
                  printingId: face.id,
                  faceId: face.faceId,
                },
              ],
            },
            { signal },
          ),
        );
      }
      return;
    }
    await runReportedMutation(() =>
      setCandidateImage.mutateAsync(
        { candidatePrintingId: image.candidate.id, mode: "main" },
        { signal },
      ),
    );
  }

  function applyChip(signal: AbortSignal, chip: FaceChip): Promise<void> {
    return chip.kind === "image"
      ? applyImage(signal, chip.image)
      : applyField(signal, chip.suggestion);
  }

  async function runPrimary(signal: AbortSignal) {
    await discards.discardAll(signal, enterIds);
  }

  useRegisterRecordActions({
    loading,
    primary:
      enabled && canCheck
        ? {
            label: primaryLabel(enterIds.length),
            disabled: pending || contributorOpen,
            run: runPrimary,
          }
        : undefined,
    useSuggestion: async (signal, n) => {
      const chip = chips[n - 1];
      if (chip !== undefined) {
        await applyChip(signal, chip);
      }
    },
  });

  return {
    chips,
    enterCount: enterIds.length,
    pending,
    contributorOpen,
    applyChip: queuedWorkspaceWrite(queue, applyChip),
    discard: queuedWorkspaceWrite(queue, discards.discard),
    runPrimary: queuedWorkspaceWrite(queue, runPrimary),
  };
}
