import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { announceSyncTrigger } from "@/features/admin/components/meta-catalog-shared";
import { MetaRunCellView } from "@/features/admin/components/meta-overview-shared";
import { useMetaArchiveJobs, useRunMetaSync } from "@/features/admin/hooks/use-admin-meta-catalog";
import { summarizeRunResult } from "@/features/admin/lib/job-run-display";
import type { TriggerEntry } from "@/features/admin/lib/meta-admin-triggers";
import {
  ARCHIVE_KIND_BY_TRIGGER,
  ARCHIVE_TRIGGERS,
} from "@/features/admin/lib/meta-admin-triggers";
import { latestRun } from "@/features/admin/lib/meta-source-overview";
import { runningRunId } from "@/features/meta/lib/meta-catalog-display";

// These re-derive published events from mirrors already held; neither belongs to a source.
export function ArchiveJobsCard() {
  const { data } = useMetaArchiveJobs();
  const runs = data?.runs ?? [];
  const run = useRunMetaSync();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<TriggerEntry | null>(null);

  const anyRunning = ARCHIVE_TRIGGERS.some(
    (entry) => runningRunId(runs, ARCHIVE_KIND_BY_TRIGGER[entry.trigger] ?? "") !== null,
  );

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

  return (
    <Card>
      <CardHeader>
        <ExpandToggle
          expanded={open}
          onClick={() => setOpen(!open)}
          className="text-base font-medium"
        >
          Archive maintenance
        </ExpandToggle>
      </CardHeader>
      {open && (
        <CardContent>
          <Table>
            <TableBody>
              {ARCHIVE_TRIGGERS.map((entry) => {
                const last = latestRun(runs, ARCHIVE_KIND_BY_TRIGGER[entry.trigger] ?? "");
                return (
                  <TableRow key={entry.trigger}>
                    <TableCell className="max-w-md whitespace-normal">
                      <div className="font-medium">{entry.label}</div>
                      <div className="text-muted-foreground">{entry.description}</div>
                    </TableCell>
                    <TableCell>
                      {last !== undefined && (
                        <MetaRunCellView
                          cell={{
                            tone:
                              last.status === "failed"
                                ? "bad"
                                : last.status === "running"
                                  ? "running"
                                  : "ok",
                            at: last.startedAt,
                            detail: last.errorMessage ?? summarizeRunResult(last.result),
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={anyRunning || run.isPending}
                        pending={run.isPending && run.variables?.trigger === entry.trigger}
                        onClick={() => {
                          if (entry.confirm === undefined) {
                            void start(entry);
                          } else {
                            setConfirming(entry);
                          }
                        }}
                      >
                        Run
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      )}
      {confirming?.confirm !== undefined && (
        <ConfirmActionDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setConfirming(null);
            }
          }}
          title={confirming.confirm.title}
          description={confirming.confirm.body(null)}
          confirmLabel={confirming.confirm.action}
          destructive={false}
          isPending={run.isPending}
          onConfirm={() => void start(confirming)}
        />
      )}
    </Card>
  );
}
