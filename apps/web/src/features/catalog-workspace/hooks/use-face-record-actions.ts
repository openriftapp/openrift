import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { toast } from "sonner";

import {
  useAcceptPrintingField,
  useCheckAllCandidatePrintings,
  useCheckCandidatePrinting,
  useUncheckCandidatePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useSetCandidatePrintingImage } from "@/features/admin/hooks/use-admin-image-mutations";
import {
  useAcceptSubmission,
  useRejectSubmission,
} from "@/features/admin/hooks/use-catalog-review";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import { toastFieldAccepted } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type {
  FaceSuggestionModel,
  FieldSuggestion,
  SourceImageCandidate,
  SuggestionSource,
  ValueLabels,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import {
  discardedLabel,
  primaryLabel,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";

export function useValueLabels(): ValueLabels {
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
    markers: Object.fromEntries(markerData.markers.map((marker) => [marker.slug, marker.label])),
    channels: Object.fromEntries(buildChannelBreadcrumbsBySlug(channelData.distributionChannels)),
  };
}

function useAnnounceUndo(): (entry: WorkspaceUndoEntry) => void {
  const pushUndo = useWorkspaceSelectionStore((state) => state.pushUndo);
  const removeUndo = useWorkspaceSelectionStore((state) => state.removeUndo);
  return (entry) => {
    pushUndo(entry);
    toast.success(entry.label, {
      action: {
        label: "Undo (Z)",
        onClick: () => {
          if (removeUndo(entry)) {
            void entry.undo();
          }
        },
      },
    });
  };
}

export function useCandidateDiscards(
  scope: readonly (readonly unknown[])[],
  sources: readonly SuggestionSource[],
) {
  const checkCandidate = useCheckCandidatePrinting(scope);
  const checkAll = useCheckAllCandidatePrintings(scope);
  const uncheckCandidate = useUncheckCandidatePrinting(scope);
  const pushUndo = useWorkspaceSelectionStore((state) => state.pushUndo);
  const announce = useAnnounceUndo();

  const uncheckAll = async (ids: readonly string[]) => {
    await Promise.all(ids.map((id) => uncheckCandidate.mutateAsync(id)));
  };

  function discard(candidatePrintingId: string) {
    checkCandidate.mutate(candidatePrintingId, {
      onSuccess: () =>
        announce({
          label: discardedLabel(sources, [candidatePrintingId]),
          undo: () => uncheckAll([candidatePrintingId]),
        }),
    });
  }

  async function discardAll(ids: readonly string[]) {
    if (ids.length === 0) {
      return;
    }
    await checkAll.mutateAsync({ extraIds: [...ids] });
    pushUndo({ label: discardedLabel(sources, ids), undo: () => uncheckAll(ids) });
  }

  return {
    discard,
    discardAll,
    pending: checkCandidate.isPending || checkAll.isPending || uncheckCandidate.isPending,
  };
}

export type FaceChip =
  | { kind: "image"; key: string; image: SourceImageCandidate }
  | { kind: "field"; key: string; suggestion: FieldSuggestion };

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
  model,
  canCheck,
  enabled,
}: {
  cardSlug: string;
  model: FaceSuggestionModel | null;
  canCheck: boolean;
  enabled: boolean;
}) {
  const scope = [adminKeys.cards.detail(cardSlug), adminKeys.cards.list, adminKeys.workspace];
  const acceptField = useAcceptPrintingField(scope);
  const discards = useCandidateDiscards(scope, model?.sources ?? []);
  const setCandidateImage = useSetCandidatePrintingImage(scope);
  const acceptSubmission = useAcceptSubmission({ cardSlug });
  const rejectSubmission = useRejectSubmission({ cardSlug });

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
    acceptSubmission.isPending ||
    rejectSubmission.isPending;

  function applyField(suggestion: FieldSuggestion) {
    if (!isAcceptPrintingField(suggestion.field)) {
      return;
    }
    const field = suggestion.field;
    if (suggestion.isContributor) {
      acceptSubmission.mutate({
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
      });
      return;
    }
    acceptField.mutate({
      printingId: suggestion.printingId,
      faceId: suggestion.faceId,
      field,
      value: suggestion.proposed,
      source: "provider",
    });
    toastFieldAccepted({
      fieldLabel: suggestion.label,
      sourceLabel: suggestion.provider,
      previousValue: suggestion.current,
      onUndo: (previous) =>
        acceptField.mutate({
          printingId: suggestion.printingId,
          faceId: suggestion.faceId,
          field,
          value: previous,
          source: "manual",
        }),
    });
  }

  function applyImage(image: SourceImageCandidate) {
    if (image.isContributor) {
      if (model?.face) {
        acceptSubmission.mutate({
          candidateCardId: image.candidate.candidateCardId,
          images: [
            {
              candidatePrintingId: image.candidate.id,
              printingId: model.face.id,
              faceId: model.face.faceId,
            },
          ],
        });
      }
      return;
    }
    setCandidateImage.mutate({ candidatePrintingId: image.candidate.id, mode: "main" });
  }

  function applyChip(chip: FaceChip) {
    if (chip.kind === "image") {
      applyImage(chip.image);
    } else {
      applyField(chip.suggestion);
    }
  }

  function reject(candidateCardId: string) {
    rejectSubmission.mutate({ candidateCardId, note: null });
  }

  async function runPrimary() {
    await discards.discardAll(enterIds);
  }

  useRegisterRecordActions({
    primary:
      enabled && canCheck
        ? {
            label: primaryLabel(enterIds.length),
            disabled: pending || contributorOpen,
            run: runPrimary,
          }
        : undefined,
    useSuggestion: (n) => {
      const chip = chips[n - 1];
      if (chip !== undefined) {
        applyChip(chip);
      }
    },
  });

  return {
    chips,
    enterCount: enterIds.length,
    pending,
    contributorOpen,
    applyChip,
    discard: discards.discard,
    reject,
    runPrimary,
  };
}
