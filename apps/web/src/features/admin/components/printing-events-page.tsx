import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";
import type { PrintingEventView } from "@openrift/shared/contracts/admin/printing-events";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { JOB_KIND } from "@openrift/shared/job-run-kinds";
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
import { TextLink } from "@/components/ui/text-link";
import { CountCell, InstantCell } from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { AdminTable } from "@/features/admin/components/admin-table";
import {
  JobRunStatusLine,
  JobRunStatusMessage,
} from "@/features/admin/components/job-run-status-line";
import { JobStatusBadge } from "@/features/admin/components/job-status-badge";
import { RefreshCountdownButton } from "@/features/admin/components/refresh-countdown-button";
import {
  isFlushPrintingEventsResult,
  useAdminPrintingEvents,
  useRetryPrintingEvents,
} from "@/features/admin/hooks/use-flush-printing-events";
import { useStartJob } from "@/features/admin/hooks/use-start-job";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { EMPTY_VALUE_TEXT } from "@/features/admin/lib/field-value-text";
import { PRINTING_EVENTS_REFRESH_INTERVAL_MS } from "@/features/admin/lib/flush-printing-events-queries";
import { runReportedMutation } from "@/lib/run-reported-mutation";

export function PrintingEventsPage() {
  const { data, refetch, isFetching, dataUpdatedAt } = useAdminPrintingEvents();
  const flush = useStartJob(JOB_KIND.flushPrintingEvents, "Flush", {
    invalidates: [adminKeys.printingEvents],
  });
  const latestRun = flush.latestRun;
  const retry = useRetryPrintingEvents();
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const events = data?.events ?? [];
  const pending = events.filter((e) => e.status === "pending");
  const failed = events.filter((e) => e.status === "failed");

  async function handleRetry(ids: string[]) {
    setRetryingIds(new Set(ids));
    if (await runReportedMutation(() => retry.mutateAsync(ids))) {
      toast.success(`Reset ${ids.length} ${pluralize(ids.length, "event")} to pending`);
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
          <PageTopBarPrimaryButton onClick={() => void flush.start()} pending={flush.running}>
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

      {latestRun && (
        <JobRunStatusLine
          run={latestRun}
          runningText={`Flush started ${formatRelativeTime(latestRun.startedAt, { seconds: true })}`}
          failedText="Flush failed"
          renderSucceeded={(run) => <FlushSucceededLine run={run} />}
        />
      )}

      <AdminTable
        columns={[
          { header: "Status", width: "w-24", cell: <StatusCell /> },
          { header: "Card", cell: <CardCell /> },
          { header: "Set", width: "w-28", cell: <SetCell /> },
          {
            header: "Retries",
            width: "w-20",
            align: "right",
            cell: <CountCell<PrintingEventView> count={(event) => event.retryCount} />,
          },
          {
            header: "Created",
            width: "w-32",
            cell: (
              <InstantCell<PrintingEventView> at={(event) => event.createdAt} relative seconds />
            ),
          },
        ]}
        data={events}
        getRowKey={(event) => event.id}
        emptyText="No queued events. The webhook is caught up."
        actions={<RetryAction retryingIds={retryingIds} onRetry={(id) => void handleRetry([id])} />}
      />
    </div>
  );
}

function StatusCell({ row: event }: AdminCellSlotProps<PrintingEventView>) {
  if (!event) {
    return null;
  }
  return event.status === "failed" ? (
    <JobStatusBadge status="failed" />
  ) : (
    <Badge variant="secondary">pending</Badge>
  );
}

function CardCell({ row: event }: AdminCellSlotProps<PrintingEventView>) {
  if (!event) {
    return null;
  }
  return (
    <>
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
        <span className="text-muted-foreground">{event.cardName ?? EMPTY_VALUE_TEXT}</span>
      )}
      {event.shortCode !== null && (
        <span className="text-muted-foreground ml-2 font-mono">{event.shortCode}</span>
      )}
    </>
  );
}

function SetCell({ row: event }: AdminCellSlotProps<PrintingEventView>) {
  if (!event) {
    return null;
  }
  return <span className="text-muted-foreground text-sm">{event.setName ?? EMPTY_VALUE_TEXT}</span>;
}

function RetryAction({
  row: event,
  retryingIds,
  onRetry,
}: AdminCellSlotProps<PrintingEventView> & {
  retryingIds: ReadonlySet<string>;
  onRetry: (id: string) => void;
}) {
  if (!event || event.status !== "failed") {
    return null;
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={() => onRetry(event.id)}
      pending={retryingIds.has(event.id)}
      title="Reset to pending"
    >
      <RotateCcwIcon className="size-3.5" />
    </Button>
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
