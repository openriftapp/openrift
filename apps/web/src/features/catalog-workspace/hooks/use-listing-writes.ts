import type { Marketplace } from "@openrift/shared/types/pricing";
import { useQueryClient } from "@tanstack/react-query";

import {
  unmapMarketplacePrintingFn,
  useUnmapMarketplacePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import {
  saveUnifiedMappings,
  useSaveMappingsByMarketplace,
} from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { PrintingAssignment } from "@/features/admin/lib/printing-assignment";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { undoScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withWriteSignal } from "@/lib/write-signal";

export function useListingWrites(cardSlug: string, record: string) {
  const queueWrite = useQueueWorkspaceWrite();
  const queryClient = useQueryClient();
  const { announce } = useWorkspaceUndo();
  const scope = [adminKeys.cards.detail(cardSlug), adminKeys.unifiedMappings.all];
  const saves = useSaveMappingsByMarketplace();
  const unmapPrinting = useUnmapMarketplacePrinting(scope);

  function done(run: (signal: AbortSignal) => Promise<unknown>, onDone?: () => void) {
    return queueWrite(async (signal) => {
      if (!(await runReportedMutation(() => run(signal)))) {
        return;
      }
      onDone?.();
      await Promise.all(scope.map((key) => queryClient.invalidateQueries({ queryKey: key })));
    });
  }

  function map(marketplace: Marketplace, assignment: PrintingAssignment, printingLabel: string) {
    const { printingId, ...sku } = assignment;
    return done(
      (signal) => saves[marketplace].mutateAsync({ mappings: [assignment] }, { signal }),
      () =>
        announce({
          label: `Mapped #${sku.externalId} to ${printingLabel} on ${record}`,
          undoneLabel: `Undone: #${sku.externalId} is unmapped again on ${record}`,
          invalidates: undoScope(scope),
          undo: (signal) =>
            withWriteSignal(signal, () =>
              unmapMarketplacePrintingFn({ data: { marketplace, printingId, ...sku }, signal }),
            ),
        }),
    );
  }

  function unmap(marketplace: Marketplace, assignments: readonly PrintingAssignment[]) {
    const [first] = assignments;
    if (first === undefined) {
      return Promise.resolve(false);
    }
    return done(
      (signal) =>
        Promise.all(
          assignments.map(({ printingId, ...sku }) =>
            unmapPrinting.mutateAsync({ marketplace, printingId, ...sku }, { signal }),
          ),
        ),
      () =>
        announce({
          label: `Unmapped #${first.externalId} on ${record}`,
          undoneLabel: `Undone: #${first.externalId} is mapped again on ${record}`,
          invalidates: undoScope(scope),
          undo: async (signal) => {
            await withWriteSignal(signal, () =>
              saveUnifiedMappings(marketplace, [...assignments], signal),
            );
          },
        }),
    );
  }

  return {
    done,
    map,
    unmap,
    saves,
    pending: unmapPrinting.isPending || Object.values(saves).some((mutation) => mutation.isPending),
  };
}
