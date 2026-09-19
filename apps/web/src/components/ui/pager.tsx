import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getPageItems } from "@/lib/paginate";
import { m } from "@/paraglide/messages.js";

// `html { scroll-padding-top }` clears the global header only, so a target
// under a PageTopBarSticky row needs that row's height on top of it.
export const PAGER_SCROLL_TARGET = "scroll-mt-[calc(var(--header-height)+4rem)]";

/**
 * The numbered pager for a server-paged list. Renders nothing on a
 * single-page result, so a caller can mount it unconditionally.
 */
export function Pager({
  page,
  totalPages,
  onPageChange,
  label,
  scrollTargetId,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
  scrollTargetId?: string;
}) {
  if (totalPages <= 1) {
    return null;
  }
  // The scroll only survives when the caller navigates with `resetScroll: false`.
  const goTo = (next: number) => {
    onPageChange(next);
    if (scrollTargetId !== undefined) {
      // oxlint-disable-next-line unicorn/prefer-query-selector -- an id is not a selector: `#${id}` breaks on characters an id may legally hold
      document.getElementById(scrollTargetId)?.scrollIntoView({ block: "start" });
    }
  };
  const items = getPageItems(page, totalPages);
  return (
    <nav className="flex items-center justify-center gap-1" aria-label={label}>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        aria-label={m.pager_previous_page()}
      >
        <ChevronLeftIcon className="size-4" />
      </Button>
      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="text-muted-foreground px-1.5">
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? "default" : "outline"}
            size="icon"
            className="size-8 font-mono"
            aria-current={item === page ? "page" : undefined}
            onClick={() => goTo(item)}
          >
            {item}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        aria-label={m.pager_next_page()}
      >
        <ChevronRightIcon className="size-4" />
      </Button>
    </nav>
  );
}
