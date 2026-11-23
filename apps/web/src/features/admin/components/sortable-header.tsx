import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Pressable } from "@/components/ui/pressable";
import { cn } from "@/lib/utils";

export type SortedState = false | "asc" | "desc";

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

/**
 * `aria-sort` belongs on the `th`, not the control inside it: the table that
 * renders the header cell sets this, not {@link SortHeaderButton}.
 */
export function ariaSort(sorted: SortedState): "ascending" | "descending" | "none" {
  if (sorted === false) {
    return "none";
  }
  return ARIA_SORT[sorted];
}

function SortIcon({ sorted }: { sorted: SortedState }) {
  if (sorted === "asc") {
    return <ArrowUpIcon className="text-foreground size-3.5 self-center" />;
  }
  if (sorted === "desc") {
    return <ArrowDownIcon className="text-foreground size-3.5 self-center" />;
  }
  return (
    <ChevronsUpDownIcon className="text-muted-foreground/50 size-3.5 self-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
  );
}

/**
 * Every admin table sorts through this one control, so headers stay
 * keyboard-reachable and focus-ringed wherever they are rendered.
 */
export function SortHeaderButton({
  sorted,
  onClick,
  align,
  children,
}: {
  sorted: SortedState;
  onClick?: ComponentProps<"button">["onClick"];
  align?: "left" | "center" | "right";
  children: ReactNode;
}) {
  const icon = <SortIcon sorted={sorted} />;
  return (
    <Pressable
      className={cn(
        "group inline-flex items-baseline gap-1 rounded-sm select-none",
        align === "right" && "flex-row-reverse",
      )}
      onClick={onClick}
    >
      {children}
      {icon}
    </Pressable>
  );
}
