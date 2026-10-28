import type { MetaSource, MetaSyncStatus } from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDayTime, formatRelativeTime } from "@openrift/shared/format-date";
import type { MetaOverlayQueueRow } from "@openrift/shared/types/api/meta";
import { getRouteApi, Link } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { ArchiveJobsCard } from "@/features/admin/components/meta-archive-jobs-card";
import { HealthCard } from "@/features/admin/components/meta-health-card";
import type { SourcedAlert } from "@/features/admin/components/meta-health-card";
import { MetaRunCellView, MetaToneDot } from "@/features/admin/components/meta-overview-shared";
import { MetaRunMenu } from "@/features/admin/components/meta-run-menu";
import { MetaSourceDetail } from "@/features/admin/components/meta-source-detail";
import { RefreshCountdownButton } from "@/features/admin/components/refresh-countdown-button";
import {
  SYNC_STATUS_POLL_MS,
  useMetaSyncSettings,
  useMetaSyncStatus,
} from "@/features/admin/hooks/use-admin-meta-catalog";
import { useAdminMetaOverlays } from "@/features/admin/hooks/use-admin-meta-overlays";
import { useMetaEventCorrections } from "@/features/admin/hooks/use-admin-meta-submissions";
import type { MetaSearch } from "@/features/admin/lib/admin-meta-search";
import { summarizeRunResult } from "@/features/admin/lib/job-run-display";
import { catalogueSource } from "@/features/admin/lib/meta-admin-triggers";
import type { MetaRun, MetaRunCell } from "@/features/admin/lib/meta-source-overview";
import {
  autoPublishRuleText,
  collectDetail,
  collectKind,
  latestRun,
  metaJobLabel,
  newestRun,
  overdueOf,
  refreshCell,
  refreshKind,
  sourceTone,
} from "@/features/admin/lib/meta-source-overview";
import {
  META_SOURCE_LABELS,
  metaSyncAlerts,
  overlayCountsForProvider,
} from "@/features/meta/lib/meta-catalog-display";
import { useMountedAt } from "@/hooks/use-mounted-at";
import { cn } from "@/lib/utils";

const routeApi = getRouteApi("/_app/_authenticated/admin/meta");

const SOURCES: MetaSource[] = ["uvsgames", "playloltcg", "topdeck", "playriftbound"];

function sourceAlerts(
  source: MetaSource,
  status: MetaSyncStatus | undefined,
  overlays: readonly MetaOverlayQueueRow[],
  now: Date,
): SourcedAlert[] {
  if (status === undefined) {
    return [];
  }
  const { unresolvedCards } = overlayCountsForProvider(overlays, source);
  return metaSyncAlerts(status, unresolvedCards, now).map((alert) => ({ ...alert, source }));
}

function lastRunCell(source: MetaSource, run: MetaRun, now: Date): MetaRunCell {
  if (run.kind === refreshKind(source)) {
    return refreshCell(run, false, now);
  }
  if (run.kind === collectKind(source)) {
    return collectDetail(run);
  }
  return {
    tone: run.status === "failed" ? "bad" : run.status === "running" ? "running" : "ok",
    at: run.startedAt,
    detail: run.errorMessage ?? summarizeRunResult(run.result),
  };
}

function NotApplicable() {
  return <span className="text-muted-foreground">n/a</span>;
}

function SourceRow({
  source,
  status,
  alertIds,
  now,
}: {
  source: MetaSource;
  status: MetaSyncStatus | undefined;
  alertIds: string[];
  now: Date;
}) {
  const name = (
    <Link
      from="/admin/meta"
      to="/admin/meta"
      search={(prev) => ({ ...prev, detail: source })}
      className="font-medium hover:underline"
    >
      {META_SOURCE_LABELS[source]}
    </Link>
  );
  if (status === undefined) {
    return (
      <TableRow>
        <TableCell>{name}</TableCell>
        <TableCell colSpan={7} className="text-muted-foreground">
          Loading…
        </TableCell>
      </TableRow>
    );
  }
  const { catalog, archive, runs, schedules } = status;
  const refresh = refreshCell(
    latestRun(runs, refreshKind(source)),
    schedules[refreshKind(source)] === true,
    now,
  );
  const collects = collectKind(source) !== null;
  const overdue = overdueOf(catalog, now);
  const newest = newestRun(runs);

  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2">
          <MetaToneDot tone={sourceTone(alertIds, runs, source)} />
          {name}
        </span>
      </TableCell>
      <TableCell className="max-w-56 whitespace-normal">
        <MetaRunCellView cell={refresh} />
      </TableCell>
      <TableCell>
        <div className="tabular-nums">{archive.events.toLocaleString()}</div>
        <div className="text-muted-foreground text-xs">
          +{archive.addedLast7Days.toLocaleString()} in 7 days
        </div>
      </TableCell>
      <TableCell>
        <div className="tabular-nums">{catalog.notStarted.toLocaleString()}</div>
        {catalog.firstStartAt !== null && (
          <div className="text-muted-foreground text-xs">
            first {formatDayTime(catalog.firstStartAt)}
          </div>
        )}
      </TableCell>
      <TableCell>
        {collects ? (
          <span className="tabular-nums">{catalog.collecting.toLocaleString()}</span>
        ) : (
          <NotApplicable />
        )}
      </TableCell>
      <TableCell>
        {collects ? (
          <>
            <div
              className={cn(
                "tabular-nums",
                overdue.behind ? "text-warning font-semibold" : "text-muted-foreground",
              )}
            >
              {overdue.count.toLocaleString()}
            </div>
            <div className="text-muted-foreground text-xs">
              {overdue.behind && overdue.oldestAt !== null
                ? `oldest ${formatRelativeTime(overdue.oldestAt, { now })}`
                : catalog.nextCheckAt === null
                  ? ""
                  : `next ${formatDayTime(catalog.nextCheckAt)}`}
            </div>
          </>
        ) : (
          <NotApplicable />
        )}
      </TableCell>
      <TableCell className="max-w-56 whitespace-normal">
        {newest === undefined ? (
          <span className="text-muted-foreground">No runs yet</span>
        ) : (
          <MetaRunCellView
            cell={lastRunCell(source, newest, now)}
            title={metaJobLabel(newest.kind)}
          />
        )}
      </TableCell>
      <TableCell className="text-right">
        <MetaRunMenu source={source} runs={runs} pendingTriage={status.counts.new} />
      </TableCell>
    </TableRow>
  );
}

function DecisionCard({
  title,
  count,
  caption,
  target,
}: {
  title: string;
  count: string;
  caption: string;
  target: MetaSearch;
}) {
  return (
    <Link
      from="/admin/meta"
      to="/admin/meta"
      search={(prev) => ({ ...prev, ...target })}
      className="hover:bg-muted/50 focus-visible:ring-ring block rounded-md border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="text-muted-foreground text-sm">{title}</div>
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          count === "0" && "text-muted-foreground",
        )}
      >
        {count}
      </div>
      <div className="text-muted-foreground text-xs">{caption}</div>
    </Link>
  );
}

export function MetaAdminOverviewPage() {
  const detail = routeApi.useSearch({ select: (search) => search.detail });
  const uvsgames = useMetaSyncStatus("uvsgames");
  const playloltcg = useMetaSyncStatus("playloltcg");
  const topdeck = useMetaSyncStatus("topdeck");
  const playriftbound = useMetaSyncStatus("playriftbound");
  const overlays = useAdminMetaOverlays();
  const corrections = useMetaEventCorrections();
  const settings = useMetaSyncSettings();
  const now = useMountedAt();

  const queries = { uvsgames, playloltcg, topdeck, playriftbound };
  const alertsBySource = new Map(
    SOURCES.map((source) => [
      source,
      sourceAlerts(source, queries[source].data, overlays.data.overlays, now),
    ]),
  );
  const alerts = SOURCES.flatMap((source) => alertsBySource.get(source) ?? []);

  const topBar = (
    <AdminPageTopBar
      title="Meta archive"
      actions={
        <RefreshCountdownButton
          onRefresh={() => {
            for (const query of Object.values(queries)) {
              void query.refetch();
            }
          }}
          isFetching={Object.values(queries).some((query) => query.isFetching)}
          dataUpdatedAt={Math.min(...Object.values(queries).map((query) => query.dataUpdatedAt))}
          intervalMs={SYNC_STATUS_POLL_MS}
        />
      }
    />
  );

  if (detail !== undefined) {
    return (
      <div className="space-y-4">
        {topBar}
        <MetaSourceDetail
          source={detail}
          status={queries[detail].data}
          alerts={alertsBySource.get(detail) ?? []}
          settings={settings.data}
          now={now}
        />
      </div>
    );
  }

  const correctionCount = corrections.data?.items.length ?? 0;
  const reviewCount = overlays.data.overlays.length + correctionCount;
  const decisionSource = SOURCES.find(
    (source) => (queries[source].data?.catalog.needsDecision ?? 0) > 0,
  );
  const needsDecision = SOURCES.reduce(
    (sum, source) => sum + (queries[source].data?.catalog.needsDecision ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      {topBar}
      <HealthCard alerts={alerts} />

      <section aria-label="Needs a decision" className="grid gap-3 sm:grid-cols-2">
        <DecisionCard
          title="Review"
          count={`${reviewCount.toLocaleString()}${corrections.data?.hasMore === true ? "+" : ""}`}
          caption="Contributor corrections, uploaded standings and decklists, and event changes"
          target={{ tab: "review" }}
        />
        <DecisionCard
          title="Needs a decision"
          count={needsDecision.toLocaleString()}
          caption="Past events that pass the auto-publish rule and have results, not published"
          target={{
            tab: "catalogue",
            source: catalogueSource(decisionSource ?? "uvsgames"),
            bucket: "needsDecision",
          }}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Sources</CardTitle>
          {settings.data !== undefined && (
            <span className="text-muted-foreground text-sm">
              {autoPublishRuleText(settings.data)}
            </span>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Mirror refresh</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Not started</TableHead>
                <TableHead>Collecting results</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SOURCES.map((source) => (
                <SourceRow
                  key={source}
                  source={source}
                  status={queries[source].data}
                  alertIds={(alertsBySource.get(source) ?? []).map((alert) => alert.id)}
                  now={now}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ArchiveJobsCard />
    </div>
  );
}
