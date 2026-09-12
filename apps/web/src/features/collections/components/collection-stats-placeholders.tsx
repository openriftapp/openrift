import { Link } from "@tanstack/react-router";
import { ChartBarIcon, SearchIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

export function StatsEmptyState() {
  return (
    <EmptyState
      className="py-20"
      icon={ChartBarIcon}
      title={m.collections_stats_empty_title()}
      description={m.collections_stats_empty_description()}
    >
      <Button variant="default" render={<Link to="/cards" />}>
        <SearchIcon />
        {m.collections_stats_empty_action()}
      </Button>
    </EmptyState>
  );
}
