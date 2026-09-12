import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Pressable } from "@/components/ui/pressable";

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
    return <ArrowUpIcon className="text-foreground size-3.5" />;
  }
  if (sorted === "desc") {
    return <ArrowDownIcon className="text-foreground size-3.5" />;
  }
  return (
    <ChevronsUpDownIcon className="text-muted-foreground/50 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
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
  /** `right` puts the icon before the label, keeping the label on the column edge. */
  align?: "left" | "center" | "right";
  children: ReactNode;
}) {
  const icon = <SortIcon sorted={sorted} />;
  return (
    <Pressable
      className="group inline-flex items-center gap-1 rounded-sm select-none"
      onClick={onClick}
    >
      {align === "right" ? (
        <>
          {icon}
          {children}
        </>
      ) : (
        <>
          {children}
          {icon}
        </>
      )}
    </Pressable>
  );
}
