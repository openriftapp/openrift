import type { DismissedValue } from "@openrift/shared/contracts/admin/card-detail-schemas";

import {
  restoreCandidateValueFn,
  useDismissCandidateValue,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { undoScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withWriteSignal } from "@/lib/write-signal";

export interface DismissedSuggestion {
  kind: "card" | "printing";
  candidateId: string;
  field: string;
  value: unknown;
  label: string;
  source: string;
}

export function useDismissSuggestion(scope: readonly (readonly unknown[])[], record: string) {
  const dismiss = useDismissCandidateValue(scope);
  const queueWrite = useQueueWorkspaceWrite();
  const { announce } = useWorkspaceUndo();

  function run({ kind, candidateId, field, value, label, source }: DismissedSuggestion) {
    return queueWrite(async (signal) => {
      const input = { kind, candidateId, field, value: value as DismissedValue };
      if (!(await runReportedMutation(() => dismiss.mutateAsync(input, { signal })))) {
        return;
      }
      announce({
        label: `Dismissed ${label} from ${source} on ${record}`,
        undoneLabel: `Undone: ${label} from ${source} is back on ${record}`,
        invalidates: undoScope(scope),
        undo: (undoSignal) =>
          withWriteSignal(undoSignal, () =>
            restoreCandidateValueFn({ data: { kind, candidateId, field }, signal: undoSignal }),
          ),
      });
    });
  }

  return { run, pending: dismiss.isPending };
}
