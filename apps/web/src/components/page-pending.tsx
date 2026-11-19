import { PageTopBarSkeleton, PageTopBarSticky } from "@/components/layout/page-top-bar";
import type { PageWidth } from "@/lib/utils";

/**
 * Pending state for a page that opens with a {@link PageTopBarSticky} bar: the bar sits where the
 * page's own bar renders and the content below fills in, so nothing on screen moves.
 */
export function PagePending({
  width = "full",
  className,
}: {
  width?: PageWidth;
  className?: string;
}) {
  return (
    <PageTopBarSticky width={width} className={className}>
      <PageTopBarSkeleton />
    </PageTopBarSticky>
  );
}
