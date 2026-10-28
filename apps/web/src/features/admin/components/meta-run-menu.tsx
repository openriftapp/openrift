import type {
  MetaCancellableJob,
  MetaSource,
  MetaSyncStatus,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { announceSyncTrigger } from "@/features/admin/components/meta-catalog-shared";
import { useCancelMetaRun, useRunMetaSync } from "@/features/admin/hooks/use-admin-meta-catalog";
import type { TriggerEntry } from "@/features/admin/lib/meta-admin-triggers";
import {
  BACKFILL_KIND,
  BACKFILL_TRIGGERS_BY_SOURCE,
  TRIGGER_GROUPS,
} from "@/features/admin/lib/meta-admin-triggers";
import { backfillDisplay, runningRunId } from "@/features/meta/lib/meta-catalog-display";

interface StopEntry {
  job: MetaCancellableJob;
  label: string;
}

function isStoppable(source: MetaSource, runs: MetaSyncStatus["runs"], entry: TriggerEntry) {
  return (
    entry.stop !== undefined && runningRunId(runs, `meta.${source}_${entry.stop.job}`) !== null
  );
}

function stopEntries(source: MetaSource, runs: MetaSyncStatus["runs"]): StopEntry[] {
  const stops: StopEntry[] = [];
  for (const entry of TRIGGER_GROUPS[source]) {
    if (entry.stop !== undefined && isStoppable(source, runs, entry)) {
      stops.push({ job: entry.stop.job, label: entry.stop.label });
    }
  }
  if (runningRunId(runs, BACKFILL_KIND[source]) !== null) {
    const label = BACKFILL_TRIGGERS_BY_SOURCE[source].idle[0]?.label ?? "the backfill";
    stops.push({ job: "backfill", label: `Stop ${label}` });
  }
  return stops;
}

function useJobStarter(source: MetaSource, pendingTriage: number) {
  const run = useRunMetaSync();
  const cancel = useCancelMetaRun(source);
  const [confirming, setConfirming] = useState<TriggerEntry | null>(null);

  async function start(entry: TriggerEntry) {
    setConfirming(null);
    let result;
    try {
      result = await run.mutateAsync({ trigger: entry.trigger });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    announceSyncTrigger(entry.label, result);
  }

  function pick(entry: TriggerEntry) {
    if (entry.confirm === undefined) {
      void start(entry);
      return;
    }
    setConfirming(entry);
  }

  const dialog = confirming?.confirm !== undefined && (
    <ConfirmActionDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setConfirming(null);
        }
      }}
      title={confirming.confirm.title}
      description={confirming.confirm.body(pendingTriage)}
      confirmLabel={confirming.confirm.action}
      destructive={false}
      isPending={run.isPending}
      onConfirm={() => void start(confirming)}
    />
  );

  return { run, cancel, pick, dialog };
}

export function MetaRunMenu({
  source,
  runs,
  pendingTriage,
}: {
  source: MetaSource;
  runs: MetaSyncStatus["runs"];
  pendingTriage: number;
}) {
  const { run, cancel, pick, dialog } = useJobStarter(source, pendingTriage);

  const backfill = backfillDisplay(runs, BACKFILL_KIND[source]);
  const history =
    backfill.phase === "running" ? [] : BACKFILL_TRIGGERS_BY_SOURCE[source][backfill.phase];
  const stops = stopEntries(source, runs);
  const jobs = TRIGGER_GROUPS[source].filter((entry) => !isStoppable(source, runs, entry));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" pending={run.isPending || cancel.isPending} />
          }
        >
          Run
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {jobs.map((entry) => (
            <DropdownMenuItem key={entry.trigger} onClick={() => pick(entry)}>
              {entry.label}
            </DropdownMenuItem>
          ))}
          {history.length > 0 && <DropdownMenuSeparator />}
          {history.map((entry) => (
            <DropdownMenuItem key={entry.trigger} onClick={() => pick(entry)}>
              {entry.label}
            </DropdownMenuItem>
          ))}
          {stops.length > 0 && <DropdownMenuSeparator />}
          {stops.map((stop) => (
            <DropdownMenuItem
              key={stop.job}
              variant="destructive"
              onClick={() => cancel.mutate({ job: stop.job })}
            >
              {stop.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  );
}

export function MetaJobRunControl({
  source,
  runs,
  entry,
  pendingTriage,
}: {
  source: MetaSource;
  runs: MetaSyncStatus["runs"];
  entry: TriggerEntry;
  pendingTriage: number;
}) {
  const { run, cancel, pick, dialog } = useJobStarter(source, pendingTriage);
  const isHistory = BACKFILL_TRIGGERS_BY_SOURCE[source].idle.includes(entry);
  const backfill = backfillDisplay(runs, BACKFILL_KIND[source]);
  const pending = run.isPending && run.variables?.trigger === entry.trigger;

  let stopJob: MetaCancellableJob | null = null;
  if (isHistory && backfill.phase === "running") {
    stopJob = "backfill";
  } else if (entry.stop !== undefined && isStoppable(source, runs, entry)) {
    stopJob = entry.stop.job;
  }

  if (stopJob !== null) {
    const job = stopJob;
    return (
      <Button
        variant="outline"
        size="sm"
        pending={cancel.isPending}
        onClick={() => cancel.mutate({ job })}
      >
        Stop
      </Button>
    );
  }

  if (isHistory && backfill.phase === "resumable") {
    const [resume, restart] = BACKFILL_TRIGGERS_BY_SOURCE[source].resumable;
    return (
      <div className="flex justify-end gap-2">
        {resume !== undefined && (
          <Button variant="outline" size="sm" disabled={run.isPending} onClick={() => pick(resume)}>
            Continue
          </Button>
        )}
        {restart !== undefined && (
          <Button
            variant="outline"
            size="sm"
            disabled={run.isPending}
            onClick={() => pick(restart)}
          >
            From scratch
          </Button>
        )}
        {dialog}
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={run.isPending}
        pending={pending}
        onClick={() => pick(entry)}
      >
        Run
      </Button>
      {dialog}
    </>
  );
}
