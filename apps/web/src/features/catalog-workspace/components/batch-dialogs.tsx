import { useState } from "react";

import { PageTopBarButton } from "@/components/layout/page-top-bar";
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
  BatchOutcome,
  BatchPreview,
  BatchReason,
} from "@/features/catalog-workspace/hooks/use-workspace-batch";
import {
  batchOutcomeText,
  listingsBatchLabel,
  useBatchRun,
  useListingsBatchPreview,
} from "@/features/catalog-workspace/hooks/use-workspace-batch";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";

const KIND = "suggested-listings";

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
  open,
  preview,
  onOpenChange,
}: {
  open: boolean;
  preview: BatchPreview;
  onOpenChange: (open: boolean) => void;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const { names, keys, ineligible } = preview;
  const run = useBatchRun(KIND);
  const [outcome, setOutcome] = useState<BatchOutcome | null>(null);
  const [running, setRunning] = useState(false);

  async function confirm(signal: AbortSignal) {
    let result: BatchOutcome | undefined;
    const ok = await runReportedMutation(async () => {
      result = await run.mutateAsync(keys, { signal });
    });
    setRunning(false);
    if (ok && result) {
      setOutcome(result);
    }
  }

  function start() {
    setRunning(true);
    void queueWrite(confirm, { limit: "long" });
  }

  function changeOpen(next: boolean) {
    if (!next && running) {
      return;
    }
    if (!next) {
      setOutcome(null);
      run.reset();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Map listings by suggestion</DialogTitle>
          <DialogDescription>
            {outcome === null
              ? "Each listing is assigned to the printing its strong suggestion names."
              : batchOutcomeText(KIND, outcome)}
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
              <DialogCancel disabled={running} />
              <Button disabled={names.length === 0} pending={running} onClick={start}>
                {listingsBatchLabel(names.length)}
              </Button>
            </>
          ) : (
            <Button onClick={() => changeOpen(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignSuggestedListingsButton() {
  const preview = useListingsBatchPreview();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<BatchPreview | null>(null);

  const count = preview?.count ?? 0;
  if (count === 0 && (preview?.ineligible.length ?? 0) === 0 && !open) {
    return null;
  }
  const openDialog = () => {
    setSnapshot(preview ?? null);
    setOpen(true);
  };
  return (
    <>
      <PageTopBarButton onClick={openDialog}>{listingsBatchLabel(count)}</PageTopBarButton>
      <BatchDialog open={open} preview={snapshot ?? EMPTY_PREVIEW} onOpenChange={setOpen} />
    </>
  );
}
