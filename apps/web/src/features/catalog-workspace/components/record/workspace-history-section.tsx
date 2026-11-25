import { Skeleton } from "@/components/ui/skeleton";
import { HistoryRow } from "@/features/admin/components/card-history-section";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import type {
  WorkspaceHistoryEvent,
  WorkspaceHistoryTarget,
} from "@/features/catalog-workspace/hooks/use-workspace-history";
import { useWorkspaceHistory } from "@/features/catalog-workspace/hooks/use-workspace-history";
import { useUserId } from "@/hooks/use-session";

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
  events: readonly WorkspaceHistoryEvent[];
  isPending: boolean;
  isError: boolean;
}) {
  const userId = useUserId();
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
    <ul className="divide-y">
      {events.map((event) => (
        <HistoryRow key={event.id} event={event} userId={userId} context={{}} />
      ))}
    </ul>
  );
}
