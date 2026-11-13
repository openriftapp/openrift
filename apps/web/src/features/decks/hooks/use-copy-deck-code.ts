import type { DeckExportResponse } from "@openrift/shared/types/api/deck";
import { toast } from "sonner";

import { useEncodeDeckCards } from "@/features/decks/hooks/use-decks";
import type { EncodeDeckCardInput } from "@/features/decks/lib/deck-encode-input";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function useCopyDeckCode(cards: EncodeDeckCardInput[]) {
  const encode = useEncodeDeckCards();
  const { copy } = useCopyToClipboard();

  async function copyCode() {
    let encoded: DeckExportResponse | undefined;
    const ok = await runReportedMutation(async () => {
      encoded = await encode.mutateAsync({ cards });
    });
    if (!ok || !encoded) {
      return;
    }
    if (await copy(encoded.code)) {
      toast.success(m.decks_menu_code_copied());
    } else {
      toast.error(m.decks_menu_code_copy_failed());
    }
    if (encoded.warnings.length > 0) {
      toast.warning(m.decks_menu_code_warnings(), { description: encoded.warnings.join(" ") });
    }
  }

  return { copyCode, pending: encode.isPending };
}
