import type { WorkspaceEvent } from "@openrift/shared/contracts/admin/catalog-workspace";
import { formatDayTime } from "@openrift/shared/format-date";

import { Spinner } from "@/components/ui/spinner";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { WorkspaceTargetLink } from "@/features/catalog-workspace/components/queue-list";
import {
  decisionSentence,
  decisionTarget,
  useWorkspaceDecisions,
} from "@/features/catalog-workspace/hooks/use-workspace-decisions";

function DecisionRow({ event }: { event: WorkspaceEvent }) {
  const target = decisionTarget(event);
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t py-2 first:border-t-0">
      <span className="text-muted-foreground w-12 shrink-0 text-sm tabular-nums">
        {formatDayTime(event.createdAt).slice(11)}
      </span>
      {target === null ? (
        <span className="font-medium">{event.label}</span>
      ) : (
        <WorkspaceTargetLink
          target={target}
          search={{}}
          className="font-medium underline-offset-4 hover:underline"
        >
          {event.label}
        </WorkspaceTargetLink>
      )}
      <span className="text-muted-foreground min-w-0 flex-1">{decisionSentence(event)}</span>
    </li>
  );
}

export function DecisionsPage() {
  const { data, error, isPending } = useWorkspaceDecisions();

  return (
    <div className="space-y-4">
      <AdminPageTopBar title="Today's decisions" />
      {error !== null && (
        <p role="alert" className="text-muted-foreground">
          {`Today's decisions could not be loaded. ${error.message}`}
        </p>
      )}
      {isPending && error === null && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {data !== undefined && data.length === 0 && (
        <p className="text-muted-foreground">No decisions yet today.</p>
      )}
      {data !== undefined && data.length > 0 && (
        <>
          <p className="text-muted-foreground text-sm">
            {data.length} today, newest first. Times are UTC.
          </p>
          <ul>
            {data.map((event) => (
              <DecisionRow key={event.id} event={event} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
