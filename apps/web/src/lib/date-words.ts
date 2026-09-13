import type { DateWords } from "@openrift/shared/format-date";

import { m } from "@/paraglide/messages.js";

const MONTH_NAMES = [
  m.date_month_1,
  m.date_month_2,
  m.date_month_3,
  m.date_month_4,
  m.date_month_5,
  m.date_month_6,
  m.date_month_7,
  m.date_month_8,
  m.date_month_9,
  m.date_month_10,
  m.date_month_11,
  m.date_month_12,
];

const MONTH_ABBREVIATIONS = [
  m.date_month_short_1,
  m.date_month_short_2,
  m.date_month_short_3,
  m.date_month_short_4,
  m.date_month_short_5,
  m.date_month_short_6,
  m.date_month_short_7,
  m.date_month_short_8,
  m.date_month_short_9,
  m.date_month_short_10,
  m.date_month_short_11,
  m.date_month_short_12,
];

const WEEKDAY_NAMES = [
  m.date_weekday_0,
  m.date_weekday_1,
  m.date_weekday_2,
  m.date_weekday_3,
  m.date_weekday_4,
  m.date_weekday_5,
  m.date_weekday_6,
];

export const DATE_WORDS: DateWords = {
  monthName: (index) => MONTH_NAMES[index]?.() ?? "",
  monthAbbreviation: (index) => MONTH_ABBREVIATIONS[index]?.() ?? "",
  weekdayName: (index) => WEEKDAY_NAMES[index]?.() ?? "",
  monthYear: (month, year) => m.date_month_year({ month, year }),
  weekdayDay: (weekday, day, month) => m.date_weekday_day({ weekday, day, month }),
  justNow: () => m.date_just_now(),
  underAMinuteAhead: () => m.date_under_a_minute_ahead(),
  seconds: (count) => m.date_unit_seconds({ count }),
  minutes: (count) => m.date_unit_minutes({ count }),
  hours: (count) => m.date_unit_hours({ count }),
  hoursMinutes: (hours, minutes) => m.date_unit_hours_minutes({ hours, minutes }),
  days: (count) => m.date_unit_days({ count }),
  weeks: (count) => m.date_unit_weeks({ count }),
  months: (count) => m.date_unit_months({ count }),
  years: (count) => m.date_unit_years({ count }),
  ago: (time) => m.date_ago({ time }),
  ahead: (time) => m.date_ahead({ time }),
  today: () => m.date_today(),
  yesterday: () => m.date_yesterday(),
  daysAgo: (count) => m.date_days_ago({ count }),
  lastWeek: () => m.date_last_week(),
  weeksAgo: (count) => m.date_weeks_ago({ count }),
  lastMonth: () => m.date_last_month(),
};
