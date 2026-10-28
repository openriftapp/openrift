import type { JobScheduleView } from "@openrift/shared/contracts/admin/job-schedules";
import type {
  MetaSource,
  MetaSyncSettings,
  MetaSyncStatus,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDayTime } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HealthCard } from "@/features/admin/components/meta-health-card";
import type { SourcedAlert } from "@/features/admin/components/meta-health-card";
import { MetaRunCellView, MetaToneDot } from "@/features/admin/components/meta-overview-shared";
import { MetaJobRunControl, MetaRunMenu } from "@/features/admin/components/meta-run-menu";
import { useRejectPassingNoResults } from "@/features/admin/hooks/use-admin-meta-catalog";
import { useJobSchedulesQuery } from "@/features/admin/hooks/use-job-schedules";
import type { MetaSearch } from "@/features/admin/lib/admin-meta-search";
import {
  BACKFILL_TRIGGERS_BY_SOURCE,
  catalogueSource,
  JOB_KIND_PREFIX,
  TRIGGER_GROUPS,
} from "@/features/admin/lib/meta-admin-triggers";
import type { MetaRunCell } from "@/features/admin/lib/meta-source-overview";
import {
  autoPublishRuleText,
  collectDetail,
  collectKind,
  latestRun,
  refreshCell,
  refreshKind,
  sourceTone,
  triggerKind,
} from "@/features/admin/lib/meta-source-overview";
import { META_SOURCE_LABELS } from "@/features/meta/lib/meta-catalog-display";
import { cn } from "@/lib/utils";

interface Segment {
  key: string;
  count: number;
  label: string;
  description: string;
  colorClass: string;
  target?: { label: string; search: MetaSearch };
  action?: ReactNode;
}

function RejectPassingButton({ source, count }: { source: MetaSource; count: number }) {
  const reject = useRejectPassingNoResults(source);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setOpen(true)}>
        Reject all
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title={`Reject ${count.toLocaleString()} events?`}
        description="They passed the auto-publish rule but have no results on the source. Refresh mirror never offers a rejected event again. Each one can be restored from the Mirror table."
        confirmLabel="Reject all"
        isPending={reject.isPending}
        onConfirm={() => {
          reject.mutate(undefined, {
            onSuccess: (result) => {
              toast.success(`Rejected ${result.rejected.toLocaleString()} events`);
              setOpen(false);
            },
          });
        }}
      />
    </>
  );
}

function SegmentBar({ segments, label }: { segments: Segment[]; label: string }) {
  const visible = segments.filter((segment) => segment.count > 0);
  return (
    <div
      role="img"
      aria-label={label}
      className="bg-muted flex h-3.5 gap-0.5 overflow-hidden rounded-sm"
    >
      {visible.map((segment) => (
        <div
          key={segment.key}
          className={cn("min-w-1.5", segment.colorClass)}
          style={{ flexGrow: segment.count }}
        />
      ))}
    </div>
  );
}

function SegmentLegend({ segments }: { segments: Segment[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {segments.map((segment) => (
        <div key={segment.key} className="flex gap-2.5">
          <span className={cn("mt-1.5 size-3 shrink-0 rounded-sm", segment.colorClass)} />
          <div>
            <dt>
              <span className="font-semibold tabular-nums">{segment.count.toLocaleString()}</span>{" "}
              {segment.label}
              {segment.target !== undefined && segment.count > 0 && (
                <>
                  {" · "}
                  <Link
                    from="/admin/meta"
                    to="/admin/meta"
                    search={(prev) => ({ ...prev, detail: undefined, ...segment.target?.search })}
                    className="text-primary text-sm hover:underline"
                  >
                    {segment.target.label}
                  </Link>
                </>
              )}
              {segment.action !== undefined && segment.count > 0 && (
                <>
                  {" · "}
                  {segment.action}
                </>
              )}
            </dt>
            <dd className="text-muted-foreground text-sm">{segment.description}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function mirrorSegments(
  source: MetaSource,
  status: MetaSyncStatus,
  minPlayers: number | undefined,
): Segment[] {
  const { catalog, counts } = status;
  const mirror = { tab: "catalogue" as const, source: catalogueSource(source) };
  const rule = minPlayers === undefined ? "the rule" : `${minPlayers}+ players`;
  return [
    {
      key: "published",
      count: counts.accepted,
      label: "published",
      description: "On the public archive.",
      colorClass: "bg-primary",
    },
    {
      key: "decision",
      count: catalog.needsDecision,
      label: "need a decision",
      description: `Ran with ${rule} and have results, but were not published.`,
      colorClass: "bg-warning",
      target: {
        label: "Decide",
        search: { ...mirror, triage: "new", minPlayers, bucket: "needsDecision" },
      },
    },
    {
      key: "no-results",
      count: catalog.passingNoResults,
      label: "pass the rule, no results",
      description: "The source recorded no rounds. Publishing one would add an empty event.",
      colorClass: "bg-muted-foreground/60",
      action: <RejectPassingButton source={source} count={catalog.passingNoResults} />,
    },
    {
      key: "skipped-upcoming",
      count: catalog.skippedUpcoming,
      label: "skipped, not started",
      description: "Judged again on every mirror refresh until they start.",
      colorClass: "bg-chart-2",
    },
    {
      key: "skipped-past",
      count: catalog.skippedPast,
      label: "skipped, past",
      description: `Never reached ${rule}. Nothing more happens to them.`,
      colorClass: "bg-border",
    },
    {
      key: "rejected",
      count: counts.dismissed,
      label: "rejected",
      description: "Turned down by hand. Refresh mirror never offers them again.",
      colorClass: "bg-destructive/60",
    },
  ];
}

function resultSegments(status: MetaSyncStatus): Segment[] {
  const { catalog } = status;
  return [
    {
      key: "final",
      count: catalog.final,
      label: "final",
      description: "Standings fetched, no more checks.",
      colorClass: "bg-success",
    },
    {
      key: "collecting",
      count: catalog.collecting,
      label: "collecting results",
      description: "Started. Checked again while standings can still change.",
      colorClass: "bg-chart-1",
    },
    {
      key: "not-started",
      count: catalog.notStarted,
      label: "not started",
      description:
        catalog.firstStartAt === null
          ? "First check when each one starts."
          : `First check when each one starts. The next starts ${formatDayTime(catalog.firstStartAt)}.`,
      colorClass: "bg-chart-2",
    },
    {
      key: "no-results",
      count: catalog.noResults,
      label: "no results",
      description: "Started, but the source recorded nothing. No more checks.",
      colorClass: "bg-border",
    },
  ];
}

function jobCell(
  source: MetaSource,
  kind: string,
  status: MetaSyncStatus,
  scheduled: boolean,
  now: Date,
): MetaRunCell | null {
  const run = latestRun(status.runs, kind);
  if (kind === refreshKind(source)) {
    return refreshCell(run, scheduled, now);
  }
  if (run === undefined) {
    return null;
  }
  if (kind === collectKind(source)) {
    return collectDetail(run);
  }
  return {
    tone: run.status === "failed" ? "bad" : run.status === "running" ? "running" : "ok",
    at: run.startedAt,
    detail: run.errorMessage ?? "",
  };
}

export function MetaSourceDetail({
  source,
  status,
  alerts,
  settings,
  now,
}: {
  source: MetaSource;
  status: MetaSyncStatus | undefined;
  alerts: SourcedAlert[];
  settings: MetaSyncSettings | undefined;
  now: Date;
}) {
  const schedules = useJobSchedulesQuery();
  const scheduleByKind = new Map<string, JobScheduleView>(
    (schedules.data?.jobs ?? []).map((job) => [job.kind, job]),
  );
  const label = META_SOURCE_LABELS[source];
  const minPlayers = settings?.autoAcceptMinPlayers ?? undefined;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <Link
          from="/admin/meta"
          to="/admin/meta"
          search={(prev) => ({ ...prev, detail: undefined })}
          className="text-muted-foreground text-sm hover:underline"
        >
          Overview
        </Link>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {status !== undefined && (
            <MetaToneDot
              tone={sourceTone(
                alerts.map((alert) => alert.id),
                status.runs,
                source,
              )}
            />
          )}
          {label}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          from="/admin/meta"
          to="/admin/meta"
          search={(prev) => ({
            ...prev,
            detail: undefined,
            tab: "catalogue" as const,
            source: catalogueSource(source),
          })}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Mirror table
        </Link>
        <Link
          to="/admin/job-runs"
          search={{ runPrefix: JOB_KIND_PREFIX[source] }}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          All runs
        </Link>
        {status !== undefined && (
          <MetaRunMenu source={source} runs={status.runs} pendingTriage={status.counts.new} />
        )}
      </div>
    </div>
  );

  if (status === undefined) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const mirror = mirrorSegments(source, status, minPlayers);
  const results = resultSegments(status);
  const refreshEntry = TRIGGER_GROUPS[source].find(
    (entry) => entry.scheduleKey === refreshKind(source),
  );
  const jobs = [...TRIGGER_GROUPS[source], ...BACKFILL_TRIGGERS_BY_SOURCE[source].idle];

  return (
    <div className="space-y-4">
      {header}
      {alerts.length > 0 && <HealthCard alerts={alerts} />}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>
              Mirrored{" "}
              <span className="text-muted-foreground tabular-nums">
                {status.catalog.total.toLocaleString()} events
              </span>
            </CardTitle>
            {refreshEntry !== undefined && (
              <p className="text-muted-foreground text-sm">{refreshEntry.description}</p>
            )}
          </div>
          {settings !== undefined && (
            <span className="text-muted-foreground text-sm">{autoPublishRuleText(settings)}</span>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <SegmentBar
            segments={mirror}
            label={mirror.map((segment) => `${segment.count} ${segment.label}`).join(", ")}
          />
          <SegmentLegend segments={mirror} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Results of published events{" "}
            <span className="text-muted-foreground tabular-nums">
              {results.reduce((sum, segment) => sum + segment.count, 0).toLocaleString()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SegmentBar
            segments={results}
            label={results.map((segment) => `${segment.count} ${segment.label}`).join(", ")}
          />
          <SegmentLegend segments={results} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Schedule (UTC)</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((entry) => {
                const kind = triggerKind(source, entry);
                const schedule = scheduleByKind.get(kind);
                const cron = schedule?.schedule ?? null;
                const nextRun = schedule?.nextRun ?? null;
                const cell = jobCell(source, kind, status, cron !== null, now);
                return (
                  <TableRow key={entry.trigger}>
                    <TableCell className="max-w-md whitespace-normal">
                      <div className="font-medium">{entry.label}</div>
                      <div className="text-muted-foreground">{entry.description}</div>
                    </TableCell>
                    <TableCell className={cn(cron === null && "text-muted-foreground")}>
                      {cron ?? "Manual"}
                    </TableCell>
                    <TableCell>{cell !== null && <MetaRunCellView cell={cell} />}</TableCell>
                    <TableCell>{nextRun !== null && formatDayTime(nextRun)}</TableCell>
                    <TableCell className="text-right">
                      <MetaJobRunControl
                        source={source}
                        runs={status.runs}
                        entry={entry}
                        pendingTriage={status.counts.new}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
