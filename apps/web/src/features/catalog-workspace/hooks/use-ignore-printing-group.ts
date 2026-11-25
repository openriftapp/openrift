import { formatPrintingCode } from "@openrift/shared/printing-code";
import type {
  AdminCardDetailResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

import { useIgnoreCandidatePrinting } from "@/features/admin/hooks/use-ignored-candidates";
import { providerOf } from "@/features/admin/lib/source-compare";
import { ignoredPrintingUndo } from "@/features/catalog-workspace/hooks/candidate-undo";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { QueryScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { combinedUndo, ignoredUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
import { runReportedMutation } from "@/lib/run-reported-mutation";

/** A failure stops the loop; Undo restores the rows ignored before it. */
export function useIgnorePrintingGroup(scope: QueryScope) {
  const ignore = useIgnoreCandidatePrinting(scope);
  const { announce } = useWorkspaceUndo();

  async function run(
    signal: AbortSignal,
    detail: AdminCardDetailResponse,
    candidates: readonly CandidatePrintingResponse[],
  ): Promise<boolean> {
    const record = detail.displayName;
    const entries = candidates.map((candidate) => ({
      provider: providerOf(detail, candidate.candidateCardId),
      externalId: candidate.externalId,
      finish: candidate.finish,
    }));
    const ignored: typeof entries = [];
    for (const entry of entries) {
      if (!(await runReportedMutation(() => ignore.mutateAsync(entry, { signal })))) {
        break;
      }
      ignored.push(entry);
    }
    if (ignored.length > 0) {
      const code = formatPrintingCode(candidates[0]?.shortCode ?? "");
      announce(
        combinedUndo(
          ignoredUndoText({ what: code, record }),
          ignored.map((entry) => ignoredPrintingUndo(entry, record)),
        ),
      );
    }
    return ignored.length === entries.length;
  }

  return { run, pending: ignore.isPending };
}
