import { Skeleton } from "@/components/ui/skeleton";

export function DeckPending() {
  return (
    <div className="px-safe space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
