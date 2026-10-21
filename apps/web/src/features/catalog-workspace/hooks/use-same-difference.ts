import type { WorkspaceSameDifferenceInput } from "@openrift/shared/contracts/admin/catalog-workspace-bulk";
import { pluralize } from "@openrift/shared/strings";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useUncheckCandidateCard } from "@/features/admin/hooks/use-admin-card-mutations";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  discardSameDifferenceFn,
  sameDifferenceQueryOptions,
} from "@/features/catalog-workspace/lib/workspace-same-difference";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";

const BULK_SCOPE = [adminKeys.workspace, adminKeys.cards.all];

export function useSameDifference(input: WorkspaceSameDifferenceInput, enabled: boolean) {
  return useQuery({ ...sameDifferenceQueryOptions(input), enabled });
}

export function useDiscardSameDifference() {
  const uncheckCandidateCard = useUncheckCandidateCard(BULK_SCOPE);
  const pushUndo = useWorkspaceSelectionStore((state) => state.pushUndo);
  const removeUndo = useWorkspaceSelectionStore((state) => state.removeUndo);
  const mutation = useMutationWithInvalidation({
    mutationFn: (input: WorkspaceSameDifferenceInput) => discardSameDifferenceFn({ data: input }),
    invalidates: BULK_SCOPE,
  });

  function discard(
    input: WorkspaceSameDifferenceInput,
    what: string,
    options?: { onSuccess?: () => void },
  ) {
    mutation.mutate(input, {
      onSuccess: ({ checked, candidateCardIds }) => {
        options?.onSuccess?.();
        if (candidateCardIds.length === 0) {
          toast.success("Nothing left to discard");
          return;
        }
        const entry: WorkspaceUndoEntry = {
          label: `Discarded ${what} on ${checked} ${pluralize(checked, "card")}`,
          undo: async () => {
            await Promise.all(candidateCardIds.map((id) => uncheckCandidateCard.mutateAsync(id)));
          },
        };
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
      },
    });
  }

  return { discard, isPending: mutation.isPending };
}
