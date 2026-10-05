import { Skeleton } from "@/components/ui/skeleton";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function RoutePending() {
  return (
    <div
      role="status"
      aria-label={m.common_loading()}
      className={cn(PAGE_PADDING, PAGE_WIDTH.full, "flex flex-col gap-4")}
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
