import { Skeleton } from "@/components/ui/skeleton";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";

export function DeckPending() {
  return (
    <div className={cn(PAGE_WIDTH.full, PAGE_PADDING_NO_TOP)}>
      <div className="flex h-(--control-h) items-center">
        <Skeleton className="h-6 w-48" />
      </div>
      <Skeleton className="mt-3 h-64 w-full" />
    </div>
  );
}
