import type { MetaResultsState } from "@openrift/shared/meta-results";

import { Badge } from "@/components/ui/badge";
import { metaEventStatusLabels } from "@/features/meta/lib/meta-format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** Nothing once an event's results are on file: that is the archive's normal state. */
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
  if (state === "noResults") {
    return (
      <Badge variant="outline" className={cn("shrink-0", className)}>
        {m.meta_event_no_results()}
      </Badge>
    );
  }
  return null;
}
