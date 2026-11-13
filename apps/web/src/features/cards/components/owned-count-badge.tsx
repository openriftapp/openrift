import { CountWithTotal } from "@/components/ui/count-pill";

export const OWNED_COUNT_BADGE_CLASS =
  "bg-foreground text-background ring-background text-2xs flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 font-bold tabular-nums ring-2";

export function OwnedCountBadge({ count, totalCount }: { count: number; totalCount?: number }) {
  return (
    <span className={OWNED_COUNT_BADGE_CLASS}>
      ×<CountWithTotal count={count} totalCount={totalCount} />
    </span>
  );
}
