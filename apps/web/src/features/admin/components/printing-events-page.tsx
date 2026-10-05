import { formatDayTimeLocal, formatRelativeTime } from "@openrift/shared/format-date";
import { pluralize } from "@openrift/shared/strings";
import { Link } from "@tanstack/react-router";
import { RotateCcwIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  PageDescription,
  PageTopBarButton,
  PageTopBarPrimaryButton,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import {
  JobRunStatusLine,
  JobRunStatusMessage,
} from "@/features/admin/components/job-run-status-line";
import { JobStatusBadge } from "@/features/admin/components/job-status-badge";
import { RefreshCountdownButton } from "@/features/admin/components/refresh-countdown-button";
import {
  FLUSH_PRINTING_EVENTS_KIND,
  isFlushPrintingEventsResult,
  useAdminPrintingEvents,
  useFlushPrintingEvents,
  useRetryPrintingEvents,
} from "@/features/admin/hooks/use-flush-printing-events";
import { useLatestJobRun } from "@/features/admin/hooks/use-latest-job-run";
import { ADMIN_TABLE_CLASS } from "@/features/admin/lib/admin-table-styles";
import { PRINTING_EVENTS_REFRESH_INTERVAL_MS } from "@/features/admin/lib/flush-printing-events-queries";
import type { JobRunView, PrintingEventView } from "@/lib/server-fns/api-types";

export function PrintingEventsPage() {
  const { data, refetch, isFetching, dataUpdatedAt } = useAdminPrintingEvents();
  const flush = useFlushPrintingEvents();
  const latestRun = useLatestJobRun(FLUSH_PRINTING_EVENTS_KIND);
  const retry = useRetryPrintingEvents();
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const events = data?.events ?? [];
  const pending = events.filter((e) => e.status === "pending");
  const failed = events.filter((e) => e.status === "failed");
  const isFlushRunning = flush.isPending || latestRun.data?.status === "running";

  async function handleFlush() {
    let started: Awaited<ReturnType<typeof flush.mutateAsync>>;
    try {
      started = await flush.mutateAsync();
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    if (started.status === "already_running") {
      toast.info("A flush is already running");
    } else {
      toast.success("Flush started");
    }
  }

  async function handleRetry(ids: string[]) {
    setRetryingIds(new Set(ids));
    try {
      await retry.mutateAsync(ids);
      toast.success(`Reset ${ids.length} ${pluralize(ids.length, "event")} to pending`);
    } catch {
      // Reported by the global mutation error toast.
    }
    setRetryingIds(new Set());
  }

  const topBar = (
    <AdminPageTopBar
      title="Printing Events"
      actions={
        <>
          {failed.length > 0 && (
            <PageTopBarButton
              onClick={() => void handleRetry(failed.map((e) => e.id))}
              pending={retry.isPending}
            >
              <RotateCcwIcon />
              Retry all failed
            </PageTopBarButton>
          )}
          <RefreshCountdownButton
            onRefresh={() => void refetch()}
            isFetching={isFetching}
            dataUpdatedAt={dataUpdatedAt}
            intervalMs={PRINTING_EVENTS_REFRESH_INTERVAL_MS}
          />
          <PageTopBarPrimaryButton onClick={() => void handleFlush()} pending={isFlushRunning}>
            <SendIcon />
            Flush now
          </PageTopBarPrimaryButton>
        </>
      }
    />
  );

  if (!data) {
    return topBar;
  }

  return (
    <div className="space-y-4">
      {topBar}
      <PageDescription>
        Pending events flush every 15 minutes. After 5 failed retries an event stops being retried.
      </PageDescription>

      <div className="text-muted-foreground flex gap-4 text-sm">
        <span>
          <strong className="text-foreground">{pending.length}</strong> pending
        </span>
        <span>
          <strong className="text-foreground">{failed.length}</strong> failed
        </span>
      </div>

      {latestRun.data && (
        <JobRunStatusLine
          run={latestRun.data}
          runningText={`Flush started ${formatRelativeTime(latestRun.data.startedAt, { seconds: true })}`}
          failedText="Flush failed"
          renderSucceeded={(run) => <FlushSucceededLine run={run} />}
        />
      )}

      <Table className={ADMIN_TABLE_CLASS}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Status</TableHead>
            <TableHead>Card</TableHead>
            <TableHead className="w-28">Set</TableHead>
            <TableHead className="w-20 text-right">Retries</TableHead>
            <TableHead className="w-32">Created</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                No queued events. The webhook is caught up.
              </TableCell>
            </TableRow>
          )}
          {events.map((event) => (
            <PrintingEventRow
              key={event.id}
              event={event}
              isRetrying={retryingIds.has(event.id)}
              onRetry={() => void handleRetry([event.id])}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PrintingEventRow({
  event,
  isRetrying,
  onRetry,
}: {
  event: PrintingEventView;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <TableRow>
      <TableCell>
        {event.status === "failed" ? (
          <JobStatusBadge status="failed" />
        ) : (
          <Badge variant="secondary">pending</Badge>
        )}
      </TableCell>
      <TableCell>
        {event.cardSlug ? (
          <TextLink
            variant="inherit"
            render={
              <Link to="/cards/$cardSlug/{-$printingSlug}" params={{ cardSlug: event.cardSlug }} />
            }
          >
            {event.cardName ?? event.cardSlug}
          </TextLink>
        ) : (
          <span className="text-muted-foreground">{event.cardName ?? "—"}</span>
        )}
        {event.shortCode !== null && (
          <span className="text-muted-foreground ml-2 font-mono">{event.shortCode}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{event.setName ?? "—"}</TableCell>
      <TableCell className="text-right font-mono">{event.retryCount}</TableCell>
      <TableCell className="font-mono text-sm" title={formatDayTimeLocal(event.createdAt)}>
        {formatRelativeTime(event.createdAt, { seconds: true })}
      </TableCell>
      <TableCell>
        {event.status === "failed" && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onRetry}
            pending={isRetrying}
            title="Reset to pending"
          >
            <RotateCcwIcon className="size-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function FlushSucceededLine({ run }: { run: JobRunView }) {
  if (!isFlushPrintingEventsResult(run.result)) {
    return <JobRunStatusMessage status="succeeded">Last flush completed</JobRunStatusMessage>;
  }
  const { sent, failed } = run.result;
  if (sent === 0 && failed === 0) {
    return (
      <JobRunStatusMessage status="succeeded">No pending events on last flush</JobRunStatusMessage>
    );
  }
  return (
    <JobRunStatusMessage
      status="succeeded"
      className={failed === 0 ? "text-success" : "text-warning [&>svg]:text-warning"}
    >
      Last flush sent {sent}, failed {failed}
    </JobRunStatusMessage>
  );
}
