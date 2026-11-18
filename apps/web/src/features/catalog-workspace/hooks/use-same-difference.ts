import type { WorkspaceSameDifferenceInput } from "@openrift/shared/contracts/admin/catalog-workspace-bulk";
import { pluralize } from "@openrift/shared/strings";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { uncheckCandidateCardsFn } from "@/features/admin/hooks/use-admin-card-mutations";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { queuedWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import {
  discardSameDifferenceFn,
  sameDifferenceQueryOptions,
} from "@/features/catalog-workspace/lib/workspace-same-difference";
import { undoScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { runReportedMutation } from "@/lib/run-reported-mutation";

const BULK_SCOPE = [adminKeys.workspace, adminKeys.cards.all];

export function useSameDifference(input: WorkspaceSameDifferenceInput, enabled: boolean) {
  return useQuery({ ...sameDifferenceQueryOptions(input), enabled });
}

export function useDiscardSameDifference() {
  const { announce } = useWorkspaceUndo();
  const mutation = useMutationWithInvalidation({
    mutationFn: (input: WorkspaceSameDifferenceInput) => discardSameDifferenceFn({ data: input }),
    invalidates: BULK_SCOPE,
  });

  async function discard(
    input: WorkspaceSameDifferenceInput,
    what: string,
    options?: { onSuccess?: () => void },
  ): Promise<void> {
    let result: Awaited<ReturnType<typeof mutation.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      result = await mutation.mutateAsync(input);
    });
    if (!ok || !result) {
      return;
    }
    const { checked, candidateCardIds } = result;
    options?.onSuccess?.();
    if (candidateCardIds.length === 0) {
      toast.success("Nothing left to discard");
      return;
    }
    const record = `${checked} ${pluralize(checked, "card")}`;
    announce({
      label: `Discarded ${what} on ${record}`,
      undoneLabel: `Undone: ${what} restored on ${record}`,
      invalidates: undoScope(BULK_SCOPE),
      undo: async () => {
        await uncheckCandidateCardsFn({ data: { candidateCardIds } });
      },
    });
  }

  return { discard: queuedWorkspaceWrite(discard), isPending: mutation.isPending };
}
