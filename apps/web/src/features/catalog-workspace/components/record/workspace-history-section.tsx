import type { WorkspaceEvent } from "@openrift/shared/contracts/admin/catalog-workspace";
import { formatRelativeTime } from "@openrift/shared/format-date";

import { Skeleton } from "@/components/ui/skeleton";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import type { WorkspaceHistoryTarget } from "@/features/catalog-workspace/hooks/use-workspace-history";
import { useWorkspaceHistory } from "@/features/catalog-workspace/hooks/use-workspace-history";

export function WorkspaceHistorySection({
  target,
  summary,
}: {
  target: WorkspaceHistoryTarget;
  summary?: string;
}) {
  const history = useWorkspaceHistory(target);
  return (
    <RecordSection
      title="History"
      collapsible
      defaultOpen={false}
      summary={summary ?? history.summary}
    >
      <WorkspaceHistoryList
        events={history.events}
        isPending={history.isPending}
        isError={history.isError}
      />
    </RecordSection>
  );
}

function WorkspaceHistoryList({
  events,
  isPending,
  isError,
}: {
  events: readonly WorkspaceEvent[];
  isPending: boolean;
  isError: boolean;
}) {
  if (isPending) {
    return <Skeleton className="h-16 w-full" />;
  }
  if (isError) {
    return <p className="text-muted-foreground text-sm">The change log could not be loaded.</p>;
  }
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">Nothing has happened here yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-baseline gap-x-3">
          <span className="min-w-0 flex-1">{event.label}</span>
          <span className="text-muted-foreground text-sm">
            {formatRelativeTime(event.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
