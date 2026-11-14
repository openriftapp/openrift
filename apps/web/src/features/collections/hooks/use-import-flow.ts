import type { ListKind } from "@openrift/shared/types/api/list";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCreateCollection } from "@/features/collections/hooks/use-collections";
import { useAddCopies, useDisposeCopies } from "@/features/collections/hooks/use-copies";
import { useCopiesCollection } from "@/features/collections/hooks/use-copies-collection";
import { useImportReview } from "@/features/collections/hooks/use-import-review";
import { IMPORT_BATCH_SIZE } from "@/features/collections/lib/import-flow-shared";
import type { ImportCopyMetadata } from "@/features/collections/lib/import-parsers";
import { copyIdsInCollection, LIST_TARGET_PREFIX } from "@/features/collections/lib/import-replace";
import { useImportHandoffStore } from "@/features/collections/stores/import-handoff-store";
import { useBulkAddListEntries, useLists } from "@/features/lists/hooks/use-lists";
import type { ImportableListKind } from "@/features/lists/lib/list-import-payload";
import { buildListImportPayload } from "@/features/lists/lib/list-import-payload";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { sendInBatches } from "@/lib/send-in-batches";
import { m } from "@/paraglide/messages.js";

export interface ImportableListOption {
  id: string;
  name: string;
  kind: ImportableListKind;
}

/**
 * Copy-kind lists track specific owned copies, which a CSV can't reference,
 * so they're excluded here.
 */
export function toImportableListOptions(
  lists: readonly { id: string; name: string; kind: ListKind }[],
): ImportableListOption[] {
  return lists
    .filter((list) => list.kind === "card" || list.kind === "printing")
    .map((list) => ({ id: list.id, name: list.name, kind: list.kind as ImportableListKind }));
}

export function useImportFlow() {
  const addCopies = useAddCopies();
  const disposeCopies = useDisposeCopies();
  const copiesCollection = useCopiesCollection();
  const createCollection = useCreateCollection();
  const bulkAddEntries = useBulkAddListEntries();
  const navigate = useNavigate();
  const review = useImportReview({ promoteSingleCard: false, tieBreak: "sourceCode" });
  const { importableEntries, summary, setRawText, handleParse } = review;

  const { data: lists } = useLists();
  const importableLists = toImportableListOptions(lists);

  const [collectionId, setCollectionId] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const handoff = useImportHandoffStore.getState().takeHandoff();
    if (!handoff) {
      return;
    }
    setRawText(handoff.rawText);
    if (handoff.collectionId) {
      setCollectionId(handoff.collectionId);
    }
    handleParse(handoff.rawText);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount to consume a one-shot handoff
  }, []);

  const importIntoList = async (listId: string) => {
    const list = importableLists.find((option) => option.id === listId);
    if (!list) {
      toast.error(m.collections_import_toast_select_target());
      return;
    }

    setIsImporting(true);

    const payload = buildListImportPayload(importableEntries, list.kind);
    const addedToListMessage = m.collections_import_toast_added_to_list({
      count: summary.totalCards,
      name: list.name,
    });

    const sent = await runReportedMutation(() =>
      sendInBatches(payload, IMPORT_BATCH_SIZE, (entries) =>
        bulkAddEntries.mutateAsync({ listId, entries }),
      ),
    );
    if (sent) {
      toast.success(addedToListMessage);
      void navigate({ to: "/collections/lists/$listId", params: { listId } });
      return;
    }
    // Deliberate second toast: batches before the failing one already
    // committed, so this says the import was left half-done.
    toast.error(m.collections_import_toast_failed());
    setIsImporting(false);
  };

  // Lists and the create-new target are always additive; only an existing
  // collection with `replaceExisting` disposes its current copies first.
  const handleImport = async ({ replaceExisting = false } = {}) => {
    if (collectionId.startsWith(LIST_TARGET_PREFIX)) {
      await importIntoList(collectionId.slice(LIST_TARGET_PREFIX.length));
      return;
    }

    let targetCollectionId = collectionId;

    if (targetCollectionId === "__new__") {
      const trimmed = newCollectionName.trim();
      if (!trimmed) {
        toast.error(m.collections_import_toast_enter_collection_name());
        return;
      }
      setIsCreatingCollection(true);
      let created: Awaited<ReturnType<typeof createCollection.mutateAsync>> | undefined;
      const ok = await runReportedMutation(async () => {
        created = await createCollection.mutateAsync({ name: trimmed });
      });
      setIsCreatingCollection(false);
      if (!ok || !created) {
        return;
      }
      targetCollectionId = created.id;
    }

    if (!targetCollectionId || targetCollectionId === "__new__") {
      toast.error(m.collections_import_toast_select_collection());
      return;
    }

    setIsImporting(true);

    // Disposal refuses copies reserved by a live trade, so a pinned card
    // fails the clear and nothing is imported.
    if (replaceExisting) {
      const existingCopyIds = copiesCollection
        ? copyIdsInCollection(copiesCollection.toArray, targetCollectionId)
        : [];
      if (
        existingCopyIds.length > 0 &&
        !(await runReportedMutation(() => disposeCopies.mutateAsync({ copyIds: existingCopyIds })))
      ) {
        // Deliberate second toast: this says the collection is untouched.
        toast.error(m.collections_import_toast_clear_failed());
        setIsImporting(false);
        return;
      }
    }

    const copies: ({ printingId: string; collectionId: string } & ImportCopyMetadata)[] = [];
    for (const entry of importableEntries) {
      for (let count = 0; count < entry.entry.quantity; count++) {
        copies.push({
          printingId: entry.resolvedPrinting?.printingId ?? "",
          collectionId: targetCollectionId,
          ...entry.entry.metadata,
        });
      }
    }

    const importedMessage = m.collections_import_toast_imported({ count: summary.totalCards });

    const imported = await runReportedMutation(() =>
      sendInBatches(copies, IMPORT_BATCH_SIZE, (batch) => addCopies.mutateAsync({ copies: batch })),
    );
    if (imported) {
      toast.success(importedMessage);
      void navigate({
        to: "/collections/$collectionId",
        params: { collectionId: targetCollectionId },
      });
      return;
    }
    // Deliberate second toast: batches before the failing one already
    // committed, so this says the import was left half-done.
    toast.error(m.collections_import_toast_failed());
    setIsImporting(false);
  };

  return {
    step: review.step,
    rawText: review.rawText,
    matchedEntries: review.matchedEntries,
    parseErrors: review.parseErrors,
    collectionId,
    newCollectionName,
    importableLists,
    isImporting: isImporting || isCreatingCollection,
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

    handleRawTextChange: setRawText,
    handleCollectionChange: setCollectionId,
    handleNewCollectionNameChange: setNewCollectionName,
    handleParse,
    handleFileUpload: review.handleFileUpload,
    handleResolve: review.handleResolve,
    handleSkip: review.handleSkip,
    handleUnskip: review.handleUnskip,
    handleToggleExpand: review.handleToggleExpand,
    handleImport,
    handleBack: () => review.setStep("input"),
  };
}
