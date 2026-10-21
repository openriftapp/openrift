import type {
  WorkspaceOwner,
  WorkspaceQueueItem,
  WorkspaceSegment,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
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
  if (owner === "card") {
    return (
      <Link to="/admin/workspace/cards" search={search} className={className}>
        {children}
        <ArrowRightIcon />
      </Link>
    );
  }
  if (owner === "face") {
    return (
      <Link to="/admin/workspace/faces" search={search} className={className}>
        {children}
        <ArrowRightIcon />
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

  return (
    <section className="flex flex-col items-start gap-3 py-10">
      <h2 className="text-lg font-semibold">
        {segment === "new" ? `No new ${noun}` : `All ${noun} checked`}
      </h2>
      <p className="text-muted-foreground">{doneToday} done today.</p>
      {next !== null && (
        <QueueLink owner={next.owner} segment={next.segment}>
          {next.owner === owner
            ? `New ${noun}: ${next.count}`
            : `Next queue: ${OWNER_LABELS[next.owner]}, ${next.count} open`}
        </QueueLink>
      )}
    </section>
  );
}
