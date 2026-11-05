import { dateLeafPartsUtc, todayUtc } from "@openrift/shared/format-date";

import { DATE_WORDS } from "@/lib/date-words";
import { m } from "@/paraglide/messages.js";

export function changelogDayLabel(date: string, today: string = todayUtc()): string {
  const { month, day, year } = dateLeafPartsUtc(date, DATE_WORDS);
  return year === today.slice(0, 4)
    ? m.marketing_changelog_day({ month, day })
    : m.marketing_changelog_day_year({ month, day, year });
}
