import {
  linkCandidatePrintingsFn,
  useLinkCandidatePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { QueryScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { undoScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withWriteSignal } from "@/lib/write-signal";

export function useLinkToExisting(scope: QueryScope, record: string) {
  const link = useLinkCandidatePrintings(scope);
  const { announce } = useWorkspaceUndo();

  async function run(
    signal: AbortSignal,
    candidatePrintingIds: string[],
    printing: { id: string; label: string },
  ): Promise<boolean> {
    const ok = await runReportedMutation(() =>
      link.mutateAsync({ candidatePrintingIds, printingId: printing.id }, { signal }),
    );
    if (ok) {
      announce({
        label: `Linked the source rows to ${printing.label} on ${record}`,
        undoneLabel: `Undone: the source rows are a new printing again on ${record}`,
        invalidates: undoScope(scope),
        undo: (undoSignal) =>
          withWriteSignal(undoSignal, () =>
            linkCandidatePrintingsFn({
              data: { candidatePrintingIds, printingId: null },
              signal: undoSignal,
            }),
          ),
      });
    }
    return ok;
  }

  return { run, pending: link.isPending };
}
