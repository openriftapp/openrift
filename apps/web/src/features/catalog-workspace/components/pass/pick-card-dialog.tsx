import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import type { AdminSearchableCard } from "@/features/cards/hooks/use-card-search";
import { useAdminCardSearch } from "@/features/cards/hooks/use-card-search";
import { errorText } from "@/lib/error-text";

function PickCardBody({
  cards,
  pending,
  error,
  onPick,
}: {
  cards: readonly AdminSearchableCard[];
  pending: boolean;
  error: Error | null;
  onPick: (cardId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState("");
  const results = useAdminCardSearch(cards, search);
  return (
    <>
      <CardSearchDropdown
        results={results}
        onSearch={(query) => {
          setSearch(query);
          setTarget("");
        }}
        onSelect={setTarget}
        placeholder="Search by name…"
      />
      <Button disabled={target.length === 0} pending={pending} onClick={() => onPick(target)}>
        It is this card
      </Button>
      {error !== null && (
        <p className="text-destructive text-sm">{errorText(error, "Could not link the card.")}</p>
      )}
    </>
  );
}

export function PickCardDialog({
  open,
  cards,
  pending,
  error,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  cards: readonly AdminSearchableCard[];
  pending: boolean;
  error: Error | null;
  onOpenChange: (open: boolean) => void;
  onPick: (cardId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pick the card</DialogTitle>
        </DialogHeader>
        {open && <PickCardBody cards={cards} pending={pending} error={error} onPick={onPick} />}
      </DialogContent>
    </Dialog>
  );
}
