import { cn } from "@/lib/utils";

/** The UA sheet resets `text-transform` on form controls and preflight does not
 *  restore it, so a sortable header's own button needs the `uppercase` rule. */
export const ADMIN_TABLE_CLASS =
  "[&_thead_th]:text-muted-foreground [&_thead_th]:text-xs [&_thead_th]:font-medium [&_thead_th]:tracking-wide [&_thead_th]:uppercase [&_thead_th_button]:uppercase";

export const ADMIN_TABLE_SURFACE = "bg-card ring-border overflow-hidden rounded-lg ring-1";

export const ADMIN_TABLE_STACKED = cn(
  "max-md:block max-md:min-w-0 max-md:[&_tbody]:block max-md:[&_thead]:hidden",
  "max-md:[&_tbody_tr:empty]:block max-md:[&_tbody_tr:not(:empty)]:flex max-md:[&_tbody_tr:not(:empty)]:flex-wrap",
  "max-md:[&_tbody_tr:not(:empty)]:content-center max-md:[&_tbody_tr:not(:empty)]:items-center",
  "max-md:[&_tbody_tr:not(:empty)]:gap-x-3 max-md:[&_tbody_tr:not(:empty)]:gap-y-1",
  "max-md:[&_tbody_tr:not(:empty)]:overflow-hidden max-md:[&_tbody_tr:not(:empty)]:border-t",
  "max-md:[&_tbody_tr:not(:empty)]:px-3 max-md:[&_tbody_tr:not(:empty)]:py-2",
  "max-md:[&_td]:p-0 max-md:[&_td]:text-left max-md:[&_td]:whitespace-normal",
  "max-md:[&_td:empty]:hidden max-md:[&_td:first-child]:basis-full max-md:[&_td[colspan]]:py-6 max-md:[&_td[colspan]]:text-center",
);
