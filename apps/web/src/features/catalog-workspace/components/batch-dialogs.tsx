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
import type {
  BatchKind,
  BatchOutcome,
} from "@/features/catalog-workspace/hooks/use-workspace-batch";
import {
  batchButtonLabel,
  batchOutcomeText,
  useWorkspaceBatch,
} from "@/features/catalog-workspace/hooks/use-workspace-batch";

const CONFIRM_TITLES: Record<BatchKind, string> = {
  "trusted-cards": "Accept trusted new cards",
  "trusted-printings": "Accept trusted printings",
  "suggested-listings": "Assign listings by suggestion",
};

const CONFIRM_DESCRIPTIONS: Record<BatchKind, string> = {
  "trusted-cards":
    "Each card is created from its trusted source as it stands. Cards that fail a check are skipped and stay in New.",
  "trusted-printings":
    "Each printing is added to its card from the trusted source. Printings that fail a check are skipped and stay in New.",
  "suggested-listings": "Each listing is assigned to the printing its strong suggestion names.",
};

function BatchDialog({
  kind,
  open,
  names,
  keys,
  onOpenChange,
}: {
  kind: BatchKind;
  open: boolean;
  names: string[];
  keys: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const { run } = useWorkspaceBatch(kind, false);
  const [outcome, setOutcome] = useState<BatchOutcome | null>(null);

  function confirm() {
    run.mutate(keys, { onSuccess: setOutcome });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOutcome(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{CONFIRM_TITLES[kind]}</DialogTitle>
          <DialogDescription>
            {outcome === null ? CONFIRM_DESCRIPTIONS[kind] : batchOutcomeText(kind, outcome)}
          </DialogDescription>
        </DialogHeader>
        {outcome === null ? (
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {names.map((name, index) => (
              <li key={keys[index] ?? name}>{name}</li>
            ))}
          </ul>
        ) : (
          outcome.skipped.length > 0 && (
            <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {outcome.skipped.map((entry) => (
                <li key={entry.label}>
                  <span className="font-medium">{entry.label}</span>{" "}
                  <span className="text-muted-foreground">{entry.reason}</span>
                </li>
              ))}
            </ul>
          )
        )}
        {run.error !== null && (
          <p role="alert" className="text-destructive text-sm">
            {run.error.message}
          </p>
        )}
        <DialogFooter>
          {outcome === null ? (
            <>
              <DialogCancel />
              <Button disabled={run.isPending || names.length === 0} onClick={confirm}>
                {batchButtonLabel(kind, names.length)}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BatchButton({ kind }: { kind: BatchKind }) {
  const { preview } = useWorkspaceBatch(kind, true);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<{ names: string[]; keys: string[] } | null>(null);

  const count = preview?.count ?? 0;
  if (count === 0 && !open) {
    return null;
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSnapshot(preview ? { names: preview.names, keys: preview.keys } : null);
          setOpen(true);
        }}
      >
        {batchButtonLabel(kind, count)}
      </Button>
      <BatchDialog
        kind={kind}
        open={open}
        names={snapshot?.names ?? []}
        keys={snapshot?.keys ?? []}
        onOpenChange={setOpen}
      />
    </>
  );
}
