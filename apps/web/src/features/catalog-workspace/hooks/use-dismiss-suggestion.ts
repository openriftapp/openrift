import type { DismissedValue } from "@openrift/shared/contracts/admin/card-detail-schemas";

import {
  restoreCandidateValueFn,
  useDismissCandidateValue,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type {
  QueryScope,
  WorkspaceUndoEntry,
} from "@/features/catalog-workspace/lib/workspace-undo";
import {
  combinedUndo,
  hiddenUndoText,
  undoScope,
} from "@/features/catalog-workspace/lib/workspace-undo";
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

/** Hides each value on its source row; one click is one undo step, however many rows it hid. */
export function useDismissSuggestion(scope: QueryScope, record: string) {
  const dismiss = useDismissCandidateValue(scope);
  const queueWrite = useQueueWorkspaceWrite();
  const { announce } = useWorkspaceUndo();

  function run(parts: readonly DismissedSuggestion[]) {
    const [first] = parts;
    if (first === undefined) {
      return Promise.resolve(false);
    }
    return queueWrite(async (signal) => {
      const hidden: WorkspaceUndoEntry[] = [];
      for (const { kind, candidateId, field, value } of parts) {
        const input = { kind, candidateId, field, value: value as DismissedValue };
        if (!(await runReportedMutation(() => dismiss.mutateAsync(input, { signal })))) {
          break;
        }
        hidden.push({
          label: "",
          undoneLabel: "",
          invalidates: undoScope(scope),
          undo: (undoSignal) =>
            withWriteSignal(undoSignal, () =>
              restoreCandidateValueFn({ data: { kind, candidateId, field }, signal: undoSignal }),
            ),
        });
      }
      if (hidden.length === 0) {
        return;
      }
      const sources = [...new Set(parts.slice(0, hidden.length).map((part) => part.source))];
      announce(combinedUndo(hiddenUndoText({ label: first.label, sources, record }), hidden));
    });
  }

  return { run, pending: dismiss.isPending };
}
