import type {
  WorkspaceOwner,
  WorkspaceQueueItem,
  WorkspaceSegment,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useWorkspaceDecisions } from "@/features/catalog-workspace/hooks/use-workspace-decisions";
import type { WorkspaceRole } from "@/features/catalog-workspace/lib/owner-items";
import { nextQueue, OWNER_LABELS } from "@/features/catalog-workspace/lib/owner-items";

function QueueLink({
  owner,
  segment,
  children,
}: {
  owner: WorkspaceOwner;
  segment: WorkspaceSegment;
  children: string;
}) {
  const search = { segment: segment === "open" ? undefined : segment };
  const className = buttonVariants();
  const content = (
    <>
      {children}
      <ArrowRightIcon />
      <Kbd>↵</Kbd>
    </>
  );
  if (owner === "card") {
    return (
      <Link to="/admin/workspace/cards" search={search} className={className}>
        {content}
      </Link>
    );
  }
  if (owner === "face") {
    return (
      <Link to="/admin/workspace/faces" search={search} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <Link to="/admin/workspace/printings" search={search} className={className}>
      {children}
      <ArrowRightIcon />
    </Link>
  );
}

export function EmptyQueue({
  owner,
  segment,
  role,
  items,
  newCount,
  doneToday,
}: {
  owner: WorkspaceOwner;
  segment: WorkspaceSegment;
  role: WorkspaceRole;
  items: readonly WorkspaceQueueItem[];
  newCount: number;
  doneToday: number;
}) {
  const next =
    segment === "open" && newCount > 0
      ? { owner, segment: "new" as const, count: newCount }
      : nextQueue(items, owner, role);
  const noun = OWNER_LABELS[owner].toLowerCase();
  const navigate = useNavigate();
  const canSeeDecisions = role === "admin" || role === "reviewer";
  const { data: decisions } = useWorkspaceDecisions({ enabled: canSeeDecisions });
  const last = decisions?.[0];
  const nextLabel =
    next === null
      ? null
      : next.owner === owner
        ? `New ${noun}: ${next.count}`
        : `Next queue: ${OWNER_LABELS[next.owner]}, ${next.count} open`;

  useRegisterRecordActions(
    next === null || nextLabel === null
      ? {}
      : {
          primary: {
            label: nextLabel,
            run: () => {
              const search = { segment: next.segment === "open" ? undefined : next.segment };
              if (next.owner === "card") {
                void navigate({ to: "/admin/workspace/cards", search });
              } else if (next.owner === "face") {
                void navigate({ to: "/admin/workspace/faces", search });
              } else {
                void navigate({ to: "/admin/workspace/printings", search });
              }
            },
          },
        },
  );

  return (
    <section className="flex flex-col items-start gap-3 py-10">
      <h2 className="text-lg font-semibold">
        {segment === "new" ? `No new ${noun}` : `All ${noun} checked`}
      </h2>
      <p className="text-muted-foreground">
        {doneToday} done today.
        {last === undefined
          ? null
          : ` The last one was ${last.label}, ${formatRelativeTime(last.createdAt)}.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {canSeeDecisions && (
          <Link to="/admin/workspace/today" className={buttonVariants({ variant: "outline" })}>
            Today&apos;s decisions ›
          </Link>
        )}
        {next !== null && nextLabel !== null && (
          <QueueLink owner={next.owner} segment={next.segment}>
            {nextLabel}
          </QueueLink>
        )}
      </div>
    </section>
  );
}
