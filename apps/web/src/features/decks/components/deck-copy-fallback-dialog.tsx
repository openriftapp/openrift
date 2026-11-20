import { CopyTextPanel } from "@/components/copy-text-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeckCopyFallback } from "@/features/decks/hooks/use-deck-copy";
import { deckCopyFormatLabel } from "@/features/decks/hooks/use-deck-copy";
import { m } from "@/paraglide/messages.js";

export function DeckCopyFallbackDialog({
  fallback,
  onClose,
}: {
  fallback: DeckCopyFallback | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={fallback !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fallback ? deckCopyFormatLabel(fallback.format) : null}</DialogTitle>
          <DialogDescription>{m.decks_copy_fallback_description()}</DialogDescription>
        </DialogHeader>
        <CopyTextPanel text={fallback?.text ?? ""} rows={8} />
      </DialogContent>
    </Dialog>
  );
}
