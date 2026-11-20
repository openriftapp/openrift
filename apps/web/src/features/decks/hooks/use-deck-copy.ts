import type { DeckExportResponse } from "@openrift/shared/types/api/deck";
import { useState } from "react";
import { toast } from "sonner";

import { useEncodeDeckCards, useExportDeck } from "@/features/decks/hooks/use-decks";
import type { EncodeDeckCardInput } from "@/features/decks/lib/deck-encode-input";
import { copyPendingText } from "@/hooks/use-copy-to-clipboard";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export type DeckCopyFormat = "text" | "piltover" | "tts";

export type DeckCopySource = { deckId: string } | { cards: EncodeDeckCardInput[] };

export interface DeckCopyFallback {
  format: DeckCopyFormat;
  text: string;
}

const TTS_MOD_URL = "https://steamcommunity.com/sharedfiles/filedetails/?id=3606647746";

export function deckCopyFormatLabel(format: DeckCopyFormat): string {
  if (format === "text") {
    return m.decks_menu_copy_text();
  }
  return format === "piltover" ? m.decks_menu_copy_code() : m.decks_menu_copy_tts();
}

async function codeOf(request: Promise<DeckExportResponse>): Promise<string> {
  const data = await request;
  return data.code;
}

function announceCopied(format: DeckCopyFormat) {
  if (format === "tts") {
    toast.success(m.decks_menu_tts_copied(), {
      action: {
        label: m.decks_menu_tts_help(),
        onClick: () => globalThis.open(TTS_MOD_URL, "_blank", "noreferrer"),
      },
    });
    return;
  }
  toast.success(format === "text" ? m.decks_menu_text_copied() : m.decks_menu_code_copied());
}

export function useDeckCopy(getSource: () => DeckCopySource) {
  const exportDeck = useExportDeck();
  const encodeDeck = useEncodeDeckCards();
  const [fallback, setFallback] = useState<DeckCopyFallback | null>(null);

  const copy = async (format: DeckCopyFormat) => {
    const source = getSource();
    const request =
      "deckId" in source
        ? exportDeck.mutateAsync({ deckId: source.deckId, format })
        : encodeDeck.mutateAsync({ format, cards: source.cards });
    const written = copyPendingText(codeOf(request));
    let encoded: DeckExportResponse | undefined;
    const ok = await runReportedMutation(async () => {
      encoded = await request;
    });
    const copied = await written;
    if (!ok || !encoded) {
      return;
    }
    if (copied) {
      announceCopied(format);
    } else {
      setFallback({ format, text: encoded.code });
    }
    if (encoded.warnings.length > 0) {
      toast.warning(m.decks_menu_code_warnings(), { description: encoded.warnings.join(" ") });
    }
  };

  return {
    copy: (format: DeckCopyFormat) => void copy(format),
    fallback,
    closeFallback: () => setFallback(null),
  };
}
