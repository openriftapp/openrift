import type { DeckCopySource } from "@/features/decks/hooks/use-deck-copy";
import { useEncodeDeckCards, useExportDeck } from "@/features/decks/hooks/use-decks";

export function usePlayOnRiftAtlas(getSource: () => DeckCopySource): () => void {
  const exportDeck = useExportDeck();
  const encodeDeck = useEncodeDeckCards();

  return () => {
    // The placeholder tab opens synchronously so the popup blocker lets it
    // through; it navigates once the code arrives.
    const playTab = globalThis.open("about:blank", "_blank");
    if (!playTab) {
      return;
    }
    playTab.opener = null;
    const onSuccess = ({ code }: { code: string }) => {
      playTab.location.href = `https://play.riftatlas.com/?deckCode=${encodeURIComponent(code)}`;
    };
    const onError = () => playTab.close();
    const source = getSource();
    if ("deckId" in source) {
      exportDeck.mutate({ deckId: source.deckId, format: "piltover" }, { onSuccess, onError });
      return;
    }
    encodeDeck.mutate({ format: "piltover", cards: source.cards }, { onSuccess, onError });
  };
}
