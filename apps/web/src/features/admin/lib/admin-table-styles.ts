/** The UA sheet resets `text-transform` on form controls and preflight does not
 *  restore it, so a sortable header's own button needs the `uppercase` rule. */
export const ADMIN_TABLE_CLASS =
  "[&_thead_th]:text-muted-foreground [&_thead_th]:text-xs [&_thead_th]:font-medium [&_thead_th]:tracking-wide [&_thead_th]:uppercase [&_thead_th_button]:uppercase [&_tbody_tr]:border-0";

export const ADMIN_TABLE_SURFACE = "bg-card ring-border overflow-hidden rounded-lg ring-1";
