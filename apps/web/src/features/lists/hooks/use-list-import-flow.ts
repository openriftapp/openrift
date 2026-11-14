import { useState } from "react";
import { toast } from "sonner";

import { useImportReview } from "@/features/collections/hooks/use-import-review";
import { IMPORT_BATCH_SIZE } from "@/features/collections/lib/import-flow-shared";
import { useBulkAddListEntries } from "@/features/lists/hooks/use-lists";
import type { ImportableListKind } from "@/features/lists/lib/list-import-payload";
import { buildListImportPayload } from "@/features/lists/lib/list-import-payload";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { sendInBatches } from "@/lib/send-in-batches";
import { m } from "@/paraglide/messages.js";

export function useListImportFlow(
  listId: string,
  listKind: ImportableListKind,
  onClose: () => void,
) {
  const bulkAddEntries = useBulkAddListEntries();
  const review = useImportReview({ promoteSingleCard: listKind === "card", tieBreak: "cardName" });
  const [isImporting, setIsImporting] = useState(false);
  const { importableEntries, summary } = review;

  const handleImport = async () => {
    if (importableEntries.length === 0) {
      toast.error(m.lists_import_nothing());
      return;
    }

    setIsImporting(true);

    const payload = buildListImportPayload(importableEntries, listKind);

    const sendAllBatches = () =>
      sendInBatches(payload, IMPORT_BATCH_SIZE, (entries) =>
        bulkAddEntries.mutateAsync({ listId, entries }),
      );

    const successMessage = m.lists_import_success({ count: summary.totalCards });

    if (await runReportedMutation(sendAllBatches)) {
      toast.success(successMessage);
      setIsImporting(false);
      review.reset();
      onClose();
      return;
    }
    // Deliberate second toast on top of the global mutation error one: this says the
    // import was left half-done (batches before the failing one already committed).
    toast.error(m.lists_import_failed());
    setIsImporting(false);
  };

  return {
    step: review.step,
    rawText: review.rawText,
    matchedEntries: review.matchedEntries,
    parseErrors: review.parseErrors,
    isImporting,
    skippedIndices: review.skippedIndices,
    expandedIndices: review.expandedIndices,
    rowCount: review.rowCount,
    fileRef: review.fileRef,
    allPrintings: review.allPrintings,

    readyCount: summary.readyCount,
    toVerifyCount: summary.toVerifyCount,
    needsAttentionCount: summary.needsAttentionCount,
    importableCount: summary.importableCount,
    skippedCount: review.skippedCount,
    totalCards: summary.totalCards,

    handleRawTextChange: review.setRawText,
    handleParse: review.handleParse,
    handleFileUpload: review.handleFileUpload,
    handleResolve: review.handleResolve,
    handleSkip: review.handleSkip,
    handleUnskip: review.handleUnskip,
    handleToggleExpand: review.handleToggleExpand,
    handleImport,
    handleBack: () => review.setStep("input"),
    reset: review.reset,
  };
}
