import { indexBySideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { useEffect } from "react";

import { appendScanJournal } from "@/features/scan/lib/scan-journal";
import { useScanSessionStore } from "@/features/scan/stores/scan-session-store";

export function useScanSessionRestore(allPrintings: Printing[]): void {
  useEffect(() => {
    if (allPrintings.length === 0) {
      return;
    }
    // Rows persist the scanned side's key; a bare printing id is side 1.
    const bySideKey = indexBySideKey(allPrintings);
    const staged = useScanSessionStore.getState().restored !== null;
    useScanSessionStore.getState().restore((key) => bySideKey[key]);
    const after = useScanSessionStore.getState();
    let cards = 0;
    for (const row of after.rows.values()) {
      cards += row.count;
    }
    const pendingBatchId = after.pending?.batchId ?? null;
    appendScanJournal({ type: "open", rows: after.rows.size, cards, pending: pendingBatchId });
    if (staged) {
      appendScanJournal({
        type: "restore",
        cards: after.resumed?.cards ?? 0,
        pending: pendingBatchId,
      });
    }
  }, [allPrintings]);
}
