import {
  dateLeafPartsUtc,
  formatMonthYear,
  formatRelativeDay,
  formatRelativeTime,
  formatWeekdayDayLocal,
} from "@openrift/shared/format-date";
import { afterEach, describe, expect, it } from "vitest";

import { getLocale, overwriteGetLocale } from "@/paraglide/runtime.js";

import { DATE_WORDS } from "./date-words";

const NOW = new Date("2026-06-08T12:00:00.000Z");
const HOUR = 3_600_000;
const baseGetLocale = getLocale;

afterEach(() => {
  overwriteGetLocale(baseGetLocale);
});

describe("DATE_WORDS", () => {
  it("renders the English forms the shared defaults use", () => {
    expect(
      formatRelativeTime(new Date(NOW.getTime() - 3 * HOUR), { now: NOW, words: DATE_WORDS }),
    ).toBe("3h ago");
    expect(formatMonthYear("2026-03-01", DATE_WORDS)).toBe("March 2026");
    expect(dateLeafPartsUtc("2026-08-01", DATE_WORDS).month).toBe("AUG");
  });

  it("follows the active locale at call time", () => {
    overwriteGetLocale(() => "de");
    expect(
      formatRelativeTime(new Date(NOW.getTime() - 3 * HOUR), { now: NOW, words: DATE_WORDS }),
    ).toBe("vor 3 Std.");
    expect(
      formatRelativeTime(new Date(NOW.getTime() + 2 * HOUR + 15 * 60_000), {
        now: NOW,
        compound: true,
        words: DATE_WORDS,
      }),
    ).toBe("in 2 Std. 15 Min.");
    expect(formatMonthYear("2026-03-01", DATE_WORDS)).toBe("März 2026");
    expect(dateLeafPartsUtc("2026-10-01", DATE_WORDS).month).toBe("OKT");
    expect(formatWeekdayDayLocal(new Date(2026, 8, 11, 19, 0), DATE_WORDS)).toBe(
      "Freitag, 11. September",
    );
    expect(formatRelativeDay("2026-06-05", NOW, DATE_WORDS)).toBe("vor 3 Tagen");
  });

  it("puts the French relative marker before the time", () => {
    overwriteGetLocale(() => "fr");
    expect(
      formatRelativeTime(new Date(NOW.getTime() - 3 * HOUR), { now: NOW, words: DATE_WORDS }),
    ).toBe("il y a 3 h");
    expect(formatRelativeTime(NOW, { now: NOW, words: DATE_WORDS })).toBe("à l'instant");
  });
});
