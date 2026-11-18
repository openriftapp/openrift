import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { useAllCards } from "@/features/admin/hooks/use-admin-card-queries";
import type { SettleScope } from "@/features/admin/hooks/use-catalog-review";
import { useMoveSubmission } from "@/features/admin/hooks/use-catalog-review";
import type { RunWrite } from "@/features/admin/lib/run-write";
import { runWriteDirectly } from "@/features/admin/lib/run-write";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAdminCardSearch } from "@/features/cards/hooks/use-card-search";

interface MoveSubmissionDialogProps {
  candidateCardId: string | null;
  submitterName: string | null;
  scope?: SettleScope;
  onOpenChange: (open: boolean) => void;
  runWrite?: RunWrite;
}

export function MoveSubmissionDialog({
  candidateCardId,
  submitterName,
  scope,
  onOpenChange,
  runWrite = runWriteDirectly,
}: MoveSubmissionDialogProps) {
  return (
    <Dialog open={candidateCardId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {candidateCardId !== null && (
          <MoveSubmissionForm
            candidateCardId={candidateCardId}
            submitterName={submitterName}
            scope={scope}
            runWrite={runWrite}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveSubmissionForm({
  candidateCardId,
  submitterName,
  scope,
  runWrite,
  onDone,
}: {
  candidateCardId: string;
  submitterName: string | null;
  scope?: SettleScope;
  runWrite: RunWrite;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const moveSubmission = useMoveSubmission(scope);
  const { data: allCards } = useAllCards();
  const [query, setQuery] = useState("");
  const [cardId, setCardId] = useState<string | null>(null);
  const results = useAdminCardSearch(allCards, query);
  const who = submitterName ?? "the contributor";

  async function handleSubmit() {
    if (cardId === null) {
      return;
    }
    let moved: Awaited<ReturnType<typeof moveSubmission.mutateAsync>> | undefined;
    const ok = await runWrite(async (signal) => {
      moved = await moveSubmission.mutateAsync({ candidateCardId, cardId }, { signal });
    });
    if (!ok || !moved) {
      return;
    }
    onDone();
    void navigate({ to: "/admin/cards/$cardSlug", params: { cardSlug: moved.cardSlug } });
  }

  return (
    <DialogForm onSubmit={() => void handleSubmit()}>
      <DialogHeader>
        <DialogTitle>Move to another card</DialogTitle>
        <DialogDescription>
          The printings {who} sent move to the card you pick and wait there for review. The card
          values they sent are dropped, since they describe this card.
        </DialogDescription>
      </DialogHeader>

      <div className="py-2">
        <CardSearchDropdown
          results={results}
          onSearch={(value) => {
            setQuery(value);
            setCardId(null);
          }}
          onSelect={(id) => setCardId(id)}
          placeholder="Search by name or code…"
          ariaLabel="Card to move to"
        />
      </div>

      <DialogFooter>
        <DialogCancel />
        <Button type="submit" disabled={cardId === null} pending={moveSubmission.isPending}>
          Move
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}
