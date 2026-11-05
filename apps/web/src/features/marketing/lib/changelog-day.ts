import { formatShortDay, formatShortDayYear, todayUtc } from "@openrift/shared/format-date";

import { DATE_WORDS } from "@/lib/date-words";

export function changelogDayLabel(date: string, today: string = todayUtc()): string {
  return date.slice(0, 4) === today.slice(0, 4)
    ? formatShortDay(date, DATE_WORDS)
    : formatShortDayYear(date, DATE_WORDS);
}
