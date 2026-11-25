import type { AssignableCardResponse } from "@openrift/shared/types/api/admin";
import { useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAssignableCardSearch } from "@/features/cards/hooks/use-card-search";

export function ReassignCardDialog({
  externalId,
  open,
  allCards,
  pending,
  onOpenChange,
  onPick,
}: {
  externalId: number;
  open: boolean;
  allCards: AssignableCardResponse[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (cardId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useAssignableCardSearch(allCards, query);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move #{externalId} to another card</DialogTitle>
        </DialogHeader>
        <CardSearchDropdown
          results={results}
          onSearch={setQuery}
          onSelect={(cardId) => {
            setQuery("");
            onPick(cardId);
          }}
          disabled={pending}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- admin-only dialog, the search is its only control
          autoFocus
        />
      </DialogContent>
    </Dialog>
  );
}
