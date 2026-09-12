import { cn } from "@/lib/utils";

interface DateLeafProps {
  /** Short month label, e.g. "JUL" (caller formats; keeps the leaf SSR-agnostic). */
  month: string;
  /** Day-of-month label, e.g. "13". Omitted for a month-only date. */
  day?: string;
  /** Third line: the year where a list spans years, or a relative time. */
  caption?: string;
  size?: "sm" | "default";
  className?: string;
}

/**
 * A calendar-leaf date block: a small uppercase month over a large day number,
 * optionally over the year. Used wherever a date is the visual anchor of a row
 * or card (event heroes, timeline rows). Purely presentational — pass
 * preformatted parts.
 *
 * @returns The date leaf element.
 */
export function DateLeaf({ month, day, caption, size = "default", className }: DateLeafProps) {
  return (
    <div
      data-slot="date-leaf"
      className={cn(
        "bg-muted flex shrink-0 flex-col items-center rounded-lg border text-center leading-none",
        size === "default" ? "w-14 gap-1 py-2" : "w-11 gap-0.5 py-1.5",
        className,
      )}
    >
      <span className="text-primary text-2xs leading-none font-bold tracking-widest uppercase">
        {month}
      </span>
      {day !== undefined && (
        <span
          className={cn(
            "font-heading leading-none font-semibold tabular-nums",
            size === "default" ? "text-2xl" : "text-lg",
          )}
        >
          {day}
        </span>
      )}
      {caption !== undefined && (
        <span className="text-muted-foreground text-2xs leading-none tabular-nums">{caption}</span>
      )}
    </div>
  );
}
