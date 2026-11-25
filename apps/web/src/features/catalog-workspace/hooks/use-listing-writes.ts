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

export function useListingWrites(
  cardSlug: string,
  record: string,
  otherCardSlugs: readonly string[] = [],
) {
  const queueWrite = useQueueWorkspaceWrite();
  const queryClient = useQueryClient();
  const { announce } = useWorkspaceUndo();
  const scope = [
    ...[...new Set([cardSlug, ...otherCardSlugs])].map((slug) => adminKeys.cards.detail(slug)),
    adminKeys.unifiedMappings.all,
  ];
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

  function announceUnmap(marketplace: Marketplace, landed: readonly PrintingAssignment[]) {
    const [first] = landed;
    if (first === undefined) {
      return;
    }
    announce({
      label: `Unmapped #${first.externalId} on ${record}`,
      undoneLabel: `Undone: #${first.externalId} is mapped again on ${record}`,
      invalidates: undoScope(scope),
      undo: async (signal) => {
        await withWriteSignal(signal, () => saveUnifiedMappings(marketplace, [...landed], signal));
      },
    });
  }

  function unmap(marketplace: Marketplace, assignments: readonly PrintingAssignment[]) {
    if (assignments.length === 0) {
      return Promise.resolve(false);
    }
    return done(async (signal) => {
      const results = await Promise.allSettled(
        assignments.map(({ printingId, ...sku }) =>
          unmapPrinting.mutateAsync({ marketplace, printingId, ...sku }, { signal }),
        ),
      );
      announceUnmap(
        marketplace,
        assignments.filter((_, index) => results[index]?.status === "fulfilled"),
      );
      const failed = results.find((result) => result.status === "rejected");
      if (failed !== undefined) {
        throw failed.reason;
      }
    });
  }

  return {
    done,
    map,
    unmap,
    saves,
    pending: unmapPrinting.isPending || Object.values(saves).some((mutation) => mutation.isPending),
  };
}
