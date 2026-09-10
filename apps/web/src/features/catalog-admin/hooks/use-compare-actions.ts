import type {
  AdminCardDetailResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";
import { toast } from "sonner";

import {
  useAcceptCardField,
  useAcceptPrintingField,
  useAcceptPrintingGroup,
  useCheckAllCandidatePrintings,
  useCheckCandidateCard,
  useCheckCandidatePrinting,
  useCopyCandidatePrinting,
  useLinkCandidatePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useActivatePrintingImage,
  useSetCandidatePrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import {
  useIgnoreCandidateCard,
  useIgnoreCandidatePrinting,
} from "@/features/admin/hooks/use-ignored-candidates";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { catalogAdminKeys } from "@/features/catalog-admin/lib/catalog-admin-query-keys";
import type { CompareActions } from "@/features/catalog-admin/lib/compare-actions";
import type { CompareColumn } from "@/features/catalog-admin/lib/compare-columns";
import type { CompareAcceptTarget } from "@/features/catalog-admin/lib/compare-picks";
import {
  blockPrintingPicks,
  buildUndo,
  columnPicks,
  pickCount,
} from "@/features/catalog-admin/lib/compare-picks";
import type { CompareModel } from "@/features/catalog-admin/lib/compare-rows";
import { buildPrintingFieldsFromCandidate } from "@/features/catalog-admin/lib/printing-fields";

export function compareScope(cardSlug: string): readonly (readonly unknown[])[] {
  return [adminKeys.cards.detail(cardSlug), adminKeys.cards.list, catalogAdminKeys.reviewQueue];
}

export function useCompareActions({
  detail,
  cardSlug,
  columns,
  model,
}: {
  detail: AdminCardDetailResponse;
  cardSlug: string;
  columns: readonly CompareColumn[];
  model: CompareModel;
}): CompareActions {
  const scope = compareScope(cardSlug);
  const acceptCardField = useAcceptCardField(scope);
  const acceptPrintingField = useAcceptPrintingField(scope);
  const acceptPrintingGroup = useAcceptPrintingGroup(scope);
  const checkCandidateCard = useCheckCandidateCard(scope);
  const checkCandidatePrinting = useCheckCandidatePrinting(scope);
  const checkAllCandidatePrintings = useCheckAllCandidatePrintings(scope);
  const linkCandidatePrintings = useLinkCandidatePrintings(scope);
  const copyCandidatePrinting = useCopyCandidatePrinting(scope);
  const setCandidatePrintingImage = useSetCandidatePrintingImage(scope);
  const activatePrintingImage = useActivatePrintingImage(scope);
  const ignoreCandidateCard = useIgnoreCandidateCard(scope);
  const ignoreCandidatePrinting = useIgnoreCandidatePrinting(scope);

  const cardId = detail.card?.id;
  const candidatesById = new Map(
    detail.candidatePrintings.map((candidate) => [candidate.id, candidate]),
  );
  const providerBySource = new Map(
    detail.sources.map((source) => [source.id, source.provider] as const),
  );

  function columnLabel(columnId: string): string {
    return columns.find((column) => column.id === columnId)?.label ?? "this source";
  }

  function write(target: CompareAcceptTarget, value: unknown, source: "provider" | "manual") {
    if (target.kind === "card") {
      acceptCardField.mutate({ cardId: target.cardId, field: target.field, value, source });
      return;
    }
    acceptPrintingField.mutate({
      printingId: target.printingId,
      field: target.field,
      value,
      source,
    });
  }

  function accept(
    target: CompareAcceptTarget,
    value: unknown,
    previousValue: unknown,
    fieldLabel: string,
    sourceLabel: string,
  ) {
    write(target, value, "provider");
    const undo = buildUndo(target, previousValue, fieldLabel, sourceLabel);
    toast.success(undo.message, {
      action: { label: "Undo", onClick: () => write(undo.target, undo.value, "manual") },
    });
  }

  function ignoreRows(candidates: readonly CandidatePrintingResponse[]) {
    const jobs = candidates.flatMap((candidate) => {
      const provider = providerBySource.get(candidate.candidateCardId);
      return provider === undefined
        ? []
        : [{ provider, externalId: candidate.externalId, finish: candidate.finish }];
    });
    for (const job of jobs) {
      ignoreCandidatePrinting.mutate(job);
    }
    if (jobs.length === 0) {
      toast.warning("Nothing to ignore here");
      return;
    }
    toast.success(`Ignored ${jobs.length} row${jobs.length === 1 ? "" : "s"}`);
  }

  return {
    applyCardValue: (row, columnId, sourceLabel) => {
      const cell = row.cells.find((entry) => entry.columnId === columnId);
      if (cell === undefined || cardId === undefined) {
        return;
      }
      accept(
        { kind: "card", cardId, field: row.field },
        cell.value,
        row.siteValue,
        row.label,
        sourceLabel,
      );
    },
    applyPrintingValue: (block, rowKey, columnId, sourceLabel) => {
      const row = block.rows.find((entry) => entry.key === rowKey);
      const cell = row?.cells.find((entry) => entry.columnId === columnId);
      if (row === undefined || cell === undefined) {
        return;
      }
      accept(
        { kind: "printing", printingId: block.printingId, field: row.field },
        cell.value,
        row.siteValue,
        row.label,
        sourceLabel,
      );
    },
    applyAllFromColumn: (columnId) => {
      const picks = columnPicks(model, columnId);
      if (cardId !== undefined) {
        for (const pick of picks.cardFields) {
          acceptCardField.mutate({
            cardId,
            field: pick.field,
            value: pick.value,
            source: "provider",
          });
        }
      }
      for (const pick of picks.printingFields) {
        acceptPrintingField.mutate({ ...pick, source: "provider" });
      }
      toast.success(`Used ${pickCount(picks)} values from ${columnLabel(columnId)}`);
    },
    applyAllFromBlock: (block, columnId) => {
      const picks = blockPrintingPicks(block, columnId);
      for (const pick of picks) {
        acceptPrintingField.mutate({ ...pick, source: "provider" });
      }
      toast.success(`Used ${picks.length} values from ${columnLabel(columnId)}`);
    },
    applySourceImage: (candidatePrintingId, activeImageId) => {
      setCandidatePrintingImage.mutate({ candidatePrintingId, mode: "main" });
      if (activeImageId === null) {
        toast.success("Image taken from this source");
        return;
      }
      toast.success("Image taken from this source", {
        action: {
          label: "Undo",
          onClick: () => activatePrintingImage.mutate({ imageId: activeImageId, active: true }),
        },
      });
    },
    markColumnChecked: (column) => {
      checkCandidateCard.mutate(column.id);
      if (column.uncheckedPrintingIds.length > 0) {
        checkAllCandidatePrintings.mutate({ extraIds: [...column.uncheckedPrintingIds] });
      }
    },
    markRowChecked: (candidatePrintingId) => {
      checkCandidatePrinting.mutate(candidatePrintingId);
    },
    ignoreColumn: (column) => {
      ignoreCandidateCard.mutate({ provider: column.provider, externalId: column.externalId });
    },
    ignoreRow: (candidatePrintingId) => {
      const candidate = candidatesById.get(candidatePrintingId);
      ignoreRows(candidate === undefined ? [] : [candidate]);
    },
    ignoreRows,
    moveRow: (candidatePrintingId, printingId) => {
      linkCandidatePrintings.mutate({ candidatePrintingIds: [candidatePrintingId], printingId });
    },
    copyRow: (candidatePrintingId, printingId) => {
      copyCandidatePrinting.mutate({ id: candidatePrintingId, printingId });
    },
    unlinkRow: (candidatePrintingId) => {
      linkCandidatePrintings.mutate({
        candidatePrintingIds: [candidatePrintingId],
        printingId: null,
      });
    },
    addPrinting: (candidate, groupCandidates, overrides) => {
      if (cardId === undefined) {
        return;
      }
      acceptPrintingGroup.mutate({
        cardId,
        printingFields: buildPrintingFieldsFromCandidate(candidate, overrides),
        candidatePrintingIds: groupCandidates.map((entry) => entry.id),
      });
    },
    linkGroup: (candidates, printingId) => {
      linkCandidatePrintings.mutate({
        candidatePrintingIds: candidates.map((candidate) => candidate.id),
        printingId,
      });
    },
  };
}
