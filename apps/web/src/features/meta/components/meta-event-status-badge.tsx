import type { MetaResultsState } from "@openrift/shared/meta-results";

import { Badge } from "@/components/ui/badge";
import { metaEventStatusLabels } from "@/features/meta/lib/meta-format";
import { cn } from "@/lib/utils";

/** Nothing once an event is played: that is the archive's normal state. */
export function MetaEventStatusBadge({
  state,
  started,
  className,
}: {
  state: MetaResultsState;
  started: boolean;
  className?: string;
}) {
  if (state === "notStarted" || (state === "collecting" && !started)) {
    return (
      <Badge variant="outline" className={cn("shrink-0", className)}>
        {state === "notStarted"
          ? metaEventStatusLabels().upcoming
          : metaEventStatusLabels().in_progress}
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
