import type {
  WorkspaceOwner,
  WorkspaceQueueItem,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceTargetLink } from "@/features/catalog-workspace/components/queue-list";
import { useWorkspaceRole } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import {
  compactAge,
  groupOwnerItems,
  itemTarget,
  oldestItem,
  OWNER_LABELS,
  ownersForRole,
  queueStats,
  REASON_LABELS,
  segmentCounts,
  visibleQueueItems,
} from "@/features/catalog-workspace/lib/owner-items";
import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";

function OwnerLink({
  owner,
  className,
  children,
}: {
  owner: WorkspaceOwner;
  className: string;
  children: ReactNode;
}) {
  if (owner === "card") {
    return (
      <Link to="/admin/workspace/cards" className={className}>
        {children}
      </Link>
    );
  }
  if (owner === "face") {
    return (
      <Link to="/admin/workspace/faces" className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/admin/workspace/printings" className={className}>
      {children}
    </Link>
  );
}

function OldestStart({ item }: { item: WorkspaceQueueItem }) {
  const target = itemTarget(item);
  if (target === null) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <WorkspaceTargetLink
        target={target}
        search={item.segment === "new" ? { segment: "new" } : {}}
        className={buttonVariants({ size: "sm" })}
      >
        Start with the oldest
      </WorkspaceTargetLink>
      <span className="text-muted-foreground text-xs">
        {REASON_LABELS[item.reason]} in {OWNER_LABELS[item.owner]}
        {item.segment === "new" ? " › New" : ""}, {compactAge(item.createdAt)}
      </span>
    </div>
  );
}

export function CatalogWorkTile() {
  const role = useWorkspaceRole();
  const { data, error } = useQuery({ ...workspaceQueueQueryOptions(), enabled: role !== "none" });
  const items = data ? visibleQueueItems(data.items, role) : [];
  const groups = groupOwnerItems(items);
  const oldest = oldestItem(items, role);
  const totals = segmentCounts(groups);
  const allStats = queueStats(groups);

  return (
    <Card className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="text-muted-foreground flex items-center gap-1.5">
          <InboxIcon className="size-4" />
          Catalog work
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error === null ? (
          <p className="text-muted-foreground text-sm">
            {allStats.decisions} decisions · {totals.new} new records · {data?.doneToday ?? 0} done
            today
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">The work queue could not be loaded.</p>
        )}
        {oldest !== null && <OldestStart item={oldest} />}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ownersForRole(role).map((owner) => {
            const ownerGroups = groups.filter((group) => group.owner === owner);
            const counts = segmentCounts(ownerGroups);
            const stats = queueStats(ownerGroups);
            return (
              <OwnerLink
                key={owner}
                owner={owner}
                className="hover:bg-muted/50 flex flex-col gap-0.5 rounded-lg border p-3"
              >
                <span className="text-sm font-medium">{OWNER_LABELS[owner]}</span>
                <span className="font-heading text-2xl font-bold">
                  {(counts.open + counts.new).toLocaleString()}
                </span>
                <span className="text-muted-foreground text-xs">
                  {stats.decisions} decisions · {counts.new} new
                </span>
                {stats.oldestAt !== null && (
                  <span className="text-muted-foreground text-xs">
                    oldest {compactAge(stats.oldestAt)}
                  </span>
                )}
              </OwnerLink>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
