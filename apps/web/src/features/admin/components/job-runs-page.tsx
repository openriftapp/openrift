import type { JobRunActivity } from "@openrift/shared/contracts/admin/job-runs";
import {
  JOB_RUN_ACTIVITIES,
  JOB_STATUSES,
  JOB_TRIGGERS,
} from "@openrift/shared/contracts/admin/job-runs";
import { formatDayTimeLocal, formatRelativeTime } from "@openrift/shared/format-date";
import { getRouteApi } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Eyebrow } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { AdminFilterSelect } from "@/features/admin/components/admin-filters";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { AdminTable } from "@/features/admin/components/admin-table";
import { JobStatusBadge } from "@/features/admin/components/job-status-badge";
import { RefreshCountdownButton } from "@/features/admin/components/refresh-countdown-button";
import { useAdminJobRuns } from "@/features/admin/hooks/use-job-runs";
import { useCancelRegenerateImages } from "@/features/admin/hooks/use-rehost";
import type { JobRunsSearch } from "@/features/admin/lib/admin-job-runs-search";
import { summarizeRunResult } from "@/features/admin/lib/job-run-display";
import {
  jobRunsParamsFromSearch,
  jobRunsRefreshIntervalMs,
} from "@/features/admin/lib/job-runs-queries";
import { formatDuration } from "@/lib/format-duration";
import type { JobRunView } from "@/lib/server-fns/api-types";

const routeApi = getRouteApi("/_app/_authenticated/admin/job-runs");

/** Only resumable jobs that re-read `result` between batches can be cancelled mid-run. */
const CANCELLABLE_KINDS = new Set<string>(["images.regenerate"]);

const ANY = "__any";

/** Labels for the activity filter, whose values are not display-ready. */
const ACTIVITY_LABELS: Record<JobRunActivity, string> = {
  "did-work": "did work",
  noop: "no-op",
};

const TRIGGER_OPTIONS = [
  { value: ANY, label: "All triggers" },
  ...JOB_TRIGGERS.map((trigger) => ({ value: trigger, label: trigger })),
];

const STATUS_OPTIONS = [
  { value: ANY, label: "All statuses" },
  ...JOB_STATUSES.map((status) => ({ value: status, label: status })),
];

const ACTIVITY_OPTIONS = [
  { value: ANY, label: "All activity" },
  ...JOB_RUN_ACTIVITIES.map((activity) => ({
    value: activity,
    label: ACTIVITY_LABELS[activity],
  })),
];

/**
 * The {@link ANY} sentinel is absent from every value set, so "no filter" and
 * "not a known value" collapse into the same `undefined` with no cast.
 */
function filterValue<T extends string>(values: readonly T[], value: string): T | undefined {
  return values.find((candidate) => candidate === value);
}

function TriggerBadge({ trigger }: { trigger: JobRunView["trigger"] }) {
  return (
    <Badge variant="outline" className="font-mono">
      {trigger}
    </Badge>
  );
}

function hasResult(result: Record<string, unknown> | null): boolean {
  return result !== null && Object.keys(result).length > 0;
}

const PREFIX_MARK = "prefix:";

function kindOptions(kinds: string[], prefix: string | undefined) {
  const families = new Map<string, number>();
  for (const kind of kinds) {
    const dot = kind.indexOf(".");
    if (dot > 0) {
      const family = kind.slice(0, dot + 1);
      families.set(family, (families.get(family) ?? 0) + 1);
    }
  }
  if (prefix !== undefined && !families.has(prefix)) {
    families.set(prefix, 0);
  }
  return [
    { value: ANY, label: "All kinds" },
    ...[...families]
      .filter(([family, count]) => count > 1 || family === prefix)
      .map(([family]) => ({ value: `${PREFIX_MARK}${family}`, label: `${family}*` })),
    ...kinds.map((kind) => ({ value: kind, label: kind })),
  ];
}

export function JobRunsPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const page = search.page ?? 1;
  const { data, refetch, isFetching, dataUpdatedAt } = useAdminJobRuns(
    jobRunsParamsFromSearch(search),
  );

  // A filter change reframes the whole result set, so jump back to page 1.
  function changeFilter(next: Partial<JobRunsSearch>) {
    void navigate({ search: (prev) => ({ ...prev, ...next, page: undefined }), replace: true });
  }

  function changeKind(value: string) {
    changeFilter(
      value.startsWith(PREFIX_MARK)
        ? { runKind: undefined, runPrefix: value.slice(PREFIX_MARK.length) }
        : { runKind: value === ANY ? undefined : value, runPrefix: undefined },
    );
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const topBar = (
    <AdminPageTopBar
      title="Job Runs"
      actions={
        <RefreshCountdownButton
          onRefresh={() => void refetch()}
          isFetching={isFetching}
          dataUpdatedAt={dataUpdatedAt}
          intervalMs={jobRunsRefreshIntervalMs(page)}
        />
      }
    />
  );

  if (!data) {
    return topBar;
  }

  const { runs, total, limit, kinds } = data;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      {topBar}
      <div className="flex flex-wrap items-center gap-2">
        <AdminFilterSelect
          value={
            search.runPrefix === undefined
              ? (search.runKind ?? ANY)
              : `${PREFIX_MARK}${search.runPrefix}`
          }
          onChange={changeKind}
          label="Job kind"
          className="w-52"
          options={kindOptions(kinds, search.runPrefix)}
        />
        <AdminFilterSelect
          value={search.runTrigger ?? ANY}
          onChange={(value) => changeFilter({ runTrigger: filterValue(JOB_TRIGGERS, value) })}
          label="Trigger"
          className="w-36"
          options={TRIGGER_OPTIONS}
        />
        <AdminFilterSelect
          value={search.runStatus ?? ANY}
          onChange={(value) => changeFilter({ runStatus: filterValue(JOB_STATUSES, value) })}
          label="Status"
          className="w-36"
          options={STATUS_OPTIONS}
        />
        <AdminFilterSelect
          value={search.runActivity ?? ANY}
          onChange={(value) =>
            changeFilter({ runActivity: filterValue(JOB_RUN_ACTIVITIES, value) })
          }
          label="Activity"
          className="w-36"
          options={ACTIVITY_OPTIONS}
        />
      </div>

      <AdminTable
        columns={[
          {
            header: "",
            id: "expand",
            width: "w-8",
            cell: <ExpandCell expanded={expanded} onToggle={toggleExpanded} />,
          },
          { header: "Kind", cell: <KindCell /> },
          { header: "Trigger", width: "w-28", cell: <TriggerCell /> },
          { header: "Status", width: "w-28", cell: <StatusCell /> },
          { header: "Started", width: "w-44", cell: <StartedCell /> },
          { header: "Duration", width: "w-32", cell: <DurationCell /> },
          { header: "Result", wrap: true, cell: <ResultCell /> },
        ]}
        data={runs}
        getRowKey={(run) => run.id}
        emptyText={total === 0 ? "No job runs yet." : "No runs match the current filters."}
        // A no-op run succeeded but found nothing to do, so it renders dimmed.
        rowClassName={(run) => (run.noop === true ? "text-muted-foreground" : undefined)}
        renderExpanded={(run) =>
          expanded.has(run.id) && hasDetails(run) ? <RunDetails run={run} /> : null
        }
        actions={<CancelCell />}
        footer={
          <Pager
            page={page}
            totalPages={totalPages}
            onPageChange={(next) =>
              void navigate({
                search: (prev) => ({ ...prev, page: next === 1 ? undefined : next }),
                replace: true,
              })
            }
            label="Job run pages"
          />
        }
      />
    </div>
  );
}

function hasDetails(run: JobRunView): boolean {
  return run.errorMessage !== null || hasResult(run.result);
}

function ExpandCell({
  row: run,
  expanded,
  onToggle,
}: AdminCellSlotProps<JobRunView> & {
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (!run || !hasDetails(run)) {
    return null;
  }
  const isOpen = expanded.has(run.id);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={() => onToggle(run.id)}
      aria-expanded={isOpen}
      aria-label={isOpen ? "Hide details" : "Show details"}
    >
      {isOpen ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
    </Button>
  );
}

function KindCell({ row: run }: AdminCellSlotProps<JobRunView>) {
  return <span className="font-mono">{run?.kind}</span>;
}

function TriggerCell({ row: run }: AdminCellSlotProps<JobRunView>) {
  return run ? <TriggerBadge trigger={run.trigger} /> : null;
}

function StatusCell({ row: run }: AdminCellSlotProps<JobRunView>) {
  if (!run) {
    return null;
  }
  return (
    <div className="flex items-center gap-1.5">
      <JobStatusBadge status={run.status} />
      {run.noop === true && (
        <Badge variant="outline" className="text-muted-foreground">
          no-op
        </Badge>
      )}
    </div>
  );
}

function StartedCell({ row: run }: AdminCellSlotProps<JobRunView>) {
  if (!run) {
    return null;
  }
  return (
    <span className="font-mono" title={formatDayTimeLocal(run.startedAt)}>
      {formatRelativeTime(run.startedAt, { seconds: true })}
    </span>
  );
}

function DurationCell({ row: run }: AdminCellSlotProps<JobRunView>) {
  if (!run) {
    return null;
  }
  return run.durationMs === null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="font-mono">{formatDuration(run.durationMs)}</span>
  );
}

function ResultCell({ row: run }: AdminCellSlotProps<JobRunView>) {
  if (!run) {
    return null;
  }
  return run.errorMessage === null ? (
    <span className="text-muted-foreground">{summarizeRunResult(run.result)}</span>
  ) : (
    <span className="text-destructive">{run.errorMessage}</span>
  );
}

function CancelCell({ row: run }: AdminCellSlotProps<JobRunView>) {
  const cancelRegen = useCancelRegenerateImages();
  if (!run || run.status !== "running" || !CANCELLABLE_KINDS.has(run.kind)) {
    return null;
  }
  return (
    <Button
      variant="outline"
      size="sm"
      pending={cancelRegen.isPending}
      onClick={() => cancelRegen.mutate()}
    >
      Cancel
    </Button>
  );
}

function RunDetails({ run }: { run: JobRunView }) {
  return (
    <>
      {run.errorMessage !== null && (
        <div className="mb-2">
          <Eyebrow as="p" className="mb-0">
            Error
          </Eyebrow>
          <pre className="bg-muted text-destructive overflow-x-auto rounded-md p-2 font-mono">
            {run.errorMessage}
          </pre>
        </div>
      )}
      {hasResult(run.result) && (
        <div>
          <Eyebrow as="p" className="mb-0">
            Result
          </Eyebrow>
          <pre className="bg-muted overflow-x-auto rounded-md p-2 font-mono">
            {JSON.stringify(run.result, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
