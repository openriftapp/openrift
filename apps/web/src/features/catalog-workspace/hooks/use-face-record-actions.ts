import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { labelMap } from "@openrift/shared/enum-label";
import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";

import {
  acceptPrintingFieldFn,
  useAcceptPrintingField,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useSetCandidatePrintingImage } from "@/features/admin/hooks/use-admin-image-mutations";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import { acceptFieldWithUndo, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type {
  PrintingFieldSuggestion,
  SourceImageCandidate,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { undoScope, usedUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
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

export type FaceChip =
  | { kind: "image"; key: string; image: SourceImageCandidate }
  | { kind: "field"; key: string; suggestion: PrintingFieldSuggestion };

export function useFaceSuggestionWrites({
  cardSlug,
  record,
  face,
}: {
  cardSlug: string;
  record: string;
  face: AdminPrintingResponse | null;
}) {
  const scope = [adminKeys.cards.detail(cardSlug), adminKeys.cards.list, adminKeys.workspace];
  const acceptField = useAcceptPrintingField(scope);
  const { announce } = useWorkspaceUndo();
  const setCandidateImage = useSetCandidatePrintingImage(scope);
  const acceptSubmission = useAcceptSubmission({ cardSlug });

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
      if (face) {
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

  return {
    applyChip,
    pending: acceptField.isPending || setCandidateImage.isPending || acceptSubmission.isPending,
  };
}
