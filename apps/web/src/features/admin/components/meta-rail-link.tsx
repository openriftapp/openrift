import { Link } from "@tanstack/react-router";

import type { MetaSearch } from "@/features/admin/lib/admin-meta-search";
import { cn } from "@/lib/utils";

export function MetaRailLink({
  label,
  countText,
  active,
  search,
  className,
}: {
  label: string;
  countText: string;
  active: boolean;
  search: (prev: MetaSearch) => Partial<MetaSearch>;
  className?: string;
}) {
  return (
    <Link
      from="/admin/meta"
      to="/admin/meta"
      search={(prev) => ({ ...prev, ...search(prev), page: undefined })}
      replace
      aria-current={active ? "page" : undefined}
      className={cn(
        "hover:bg-muted/50 flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm",
        active && "bg-muted font-semibold",
        className,
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", !active && "text-muted-foreground")}>{countText}</span>
    </Link>
  );
}
