import { useState } from "react";
import { toast } from "sonner";

import { cardWord } from "@/features/scan/lib/scan-card-word";
import { appendScanJournal } from "@/features/scan/lib/scan-journal";
import { useScanSessionStore } from "@/features/scan/stores/scan-session-store";
import { m } from "@/paraglide/messages.js";

const CLEAR_CONFIRM_ABOVE = 10;

interface ScanClear {
  confirmCount: number | null;
  request: () => void;
  clearNow: () => void;
  cancelConfirm: () => void;
}

export function useScanClear(onCleared: () => void): ScanClear {
  const [confirmCount, setConfirmCount] = useState<number | null>(null);

  function clearNow() {
    const cleared = useScanSessionStore.getState().clear();
    onCleared();
    const count = cleared.reduce((sum, row) => sum + row.count, 0);
    if (count === 0) {
      return;
    }
    appendScanJournal({ type: "clear", cards: count });
    toast.success(m.scan_clear_success({ count, cards: cardWord(count) }), {
      action: {
        label: m.scan_undo(),
        onClick: () => useScanSessionStore.getState().putBack(cleared),
      },
    });
  }

  function request() {
    const rowsNow = [...useScanSessionStore.getState().rows.values()];
    const count = rowsNow.reduce((sum, row) => sum + row.count, 0);
    if (count > CLEAR_CONFIRM_ABOVE) {
      setConfirmCount(count);
      return;
    }
    clearNow();
  }

  function cancelConfirm() {
    setConfirmCount(null);
  }

  return { confirmCount, request, clearNow, cancelConfirm };
}
