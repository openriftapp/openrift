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
  BatchPreview,
  BatchReason,
} from "@/features/catalog-workspace/hooks/use-workspace-batch";
import {
  batchButtonLabel,
  batchOutcomeText,
  useWorkspaceBatch,
} from "@/features/catalog-workspace/hooks/use-workspace-batch";
import { errorText } from "@/lib/error-text";

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

function BatchReasonList({ entries }: { entries: BatchReason[] }) {
  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
      {entries.map((entry) => (
        <li key={entry.key}>
          <span className="font-medium">{entry.label}</span>{" "}
          <span className="text-muted-foreground">{entry.reason}</span>
        </li>
      ))}
    </ul>
  );
}

const EMPTY_PREVIEW: BatchPreview = { count: 0, names: [], keys: [], ineligible: [] };

function BatchDialog({
  kind,
  open,
  preview,
  onOpenChange,
}: {
  kind: BatchKind;
  open: boolean;
  preview: BatchPreview;
  onOpenChange: (open: boolean) => void;
}) {
  const { names, keys, ineligible } = preview;
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
          <>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {names.map((name, index) => (
                <li key={keys[index] ?? name}>{name}</li>
              ))}
            </ul>
            {ineligible.length > 0 && (
              <>
                <p className="text-muted-foreground text-sm">
                  {ineligible.length} will be skipped and stay in New:
                </p>
                <BatchReasonList entries={ineligible} />
              </>
            )}
          </>
        ) : (
          outcome.skipped.length > 0 && <BatchReasonList entries={outcome.skipped} />
        )}
        {run.error !== null && (
          <p role="alert" className="text-destructive text-sm">
            {errorText(run.error, "The batch failed")}
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
  const [snapshot, setSnapshot] = useState<BatchPreview | null>(null);

  const count = preview?.count ?? 0;
  if (count === 0 && (preview?.ineligible.length ?? 0) === 0 && !open) {
    return null;
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSnapshot(preview ?? null);
          setOpen(true);
        }}
      >
        {batchButtonLabel(kind, count)}
      </Button>
      <BatchDialog
        kind={kind}
        open={open}
        preview={snapshot ?? EMPTY_PREVIEW}
        onOpenChange={setOpen}
      />
    </>
  );
}
