import {
  unignoreCandidateCardFn,
  unignoreCandidatePrintingFn,
} from "@/features/admin/hooks/use-ignored-candidates";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import { ignoredUndoText, undoScope } from "@/features/catalog-workspace/lib/workspace-undo";

const IGNORE_SCOPE = undoScope([
  adminKeys.ignoredCandidates,
  adminKeys.cards.all,
  adminKeys.reviewQueue,
]);

export function ignoredCardsUndo(
  sources: readonly { provider: string; externalId: string }[],
  record: string,
  plural = false,
): WorkspaceUndoEntry {
  return {
    ...ignoredUndoText({ what: record, record, plural }),
    invalidates: IGNORE_SCOPE,
    undo: async () => {
      await Promise.all(sources.map((source) => unignoreCandidateCardFn({ data: source })));
    },
  };
}

export function ignoredPrintingUndo(
  candidate: { provider: string; externalId: string; finish: string | null },
  record: string,
): WorkspaceUndoEntry {
  return {
    ...ignoredUndoText({ what: `the ${candidate.provider} printing`, record }),
    invalidates: IGNORE_SCOPE,
    undo: async () => {
      await unignoreCandidatePrintingFn({ data: candidate });
    },
  };
}
