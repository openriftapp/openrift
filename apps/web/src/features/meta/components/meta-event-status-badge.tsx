import type { MetaResultsState } from "@openrift/shared/meta-results";

import { Badge } from "@/components/ui/badge";
import { metaEventStatusLabels } from "@/features/meta/lib/meta-format";
import { cn } from "@/lib/utils";

/** Nothing once an event is played: that is the archive's normal state. */
export function MetaEventStatusBadge({
  state,
  className,
}: {
  state: MetaResultsState;
  className?: string;
}) {
  if (state === "notStarted") {
    return (
      <Badge variant="outline" className={cn("shrink-0", className)}>
        {metaEventStatusLabels().upcoming}
      </Badge>
    );
  }
  if (state === "collecting") {
    return (
      <Badge variant="warning" className={cn("shrink-0", className)}>
        {metaEventStatusLabels().in_progress}
      </Badge>
    );
  }
  return null;
}
