import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";

import { usePrintingSuggestionApply } from "@/features/catalog-workspace/hooks/use-suggestion-writes";
import {
  queuedWorkspaceWrite,
  useQueueWorkspaceWrite,
} from "@/features/catalog-workspace/hooks/workspace-writes";
import { printingRecordScope } from "@/features/catalog-workspace/lib/record-scopes";

export function usePrintingFieldWrites({
  cardSlugs,
  record,
  printing,
  contributorName,
}: {
  cardSlugs: readonly string[];
  record: string;
  printing: AdminPrintingResponse | null;
  contributorName: (candidateCardId: string) => string;
}) {
  const queue = useQueueWorkspaceWrite();
  const fields = usePrintingSuggestionApply({
    scope: printingRecordScope(cardSlugs),
    record,
    printing,
    contributorName,
  });
  return { apply: queuedWorkspaceWrite(queue, fields.apply), pending: fields.pending };
}
