import { dateLeafParts, dateLeafPartsUtc } from "@openrift/shared/format-date";

import { DATE_WORDS } from "@/lib/date-words";
import { cn } from "@/lib/utils";

type DateLeafSource =
  | {
      /** Short month label, e.g. "JUL" (caller formats; keeps the leaf SSR-agnostic). */
      month: string;
      /** Day-of-month label, e.g. "13". Omitted for a month-only date. */
      day?: string;
      at?: never;
      clock?: never;
      showYear?: never;
    }
  | {
      at: Date | string;
      /** `utc` for a calendar day fixed globally, `local` for the viewer's clock (data-only routes). */
      clock: "utc" | "local";
      /** Puts the year on the caption line unless `caption` is given. */
      showYear?: boolean;
      month?: never;
      day?: never;
    };

type DateLeafProps = DateLeafSource & {
  /** Third line: the year where a list spans years, or a relative time. */
  caption?: string;
  size?: "sm" | "default";
  className?: string;
};

function leafLabels(props: DateLeafProps): { month: string; day?: string; year?: string } {
  if (props.at === undefined) {
    return { month: props.month, day: props.day };
  }
  return (props.clock === "utc" ? dateLeafPartsUtc : dateLeafParts)(props.at, DATE_WORDS);
}

/**
 * A calendar-leaf date block: a small uppercase month over a large day number,
 * optionally over the year. Used wherever a date is the visual anchor of a row
 * or card (event heroes, timeline rows).
 *
 * @returns The date leaf element.
 */
export function DateLeaf(props: DateLeafProps) {
  const { size = "default", className } = props;
  const { month, day, year } = leafLabels(props);
  const caption = props.caption ?? (props.showYear ? year : undefined);
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
