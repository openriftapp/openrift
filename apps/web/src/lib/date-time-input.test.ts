import { describe, expect, it } from "vitest";

import {
  combineLocalDateTimeToUtc,
  formatLocalDate,
  isValidTimeInput,
  localTimeZoneLabel,
  parseLocalDate,
  parseOptionalLocalInstant,
  sameInstant,
  splitUtcToLocalDateTime,
} from "./date-time-input";

describe("isValidTimeInput", () => {
  it("accepts 24-hour HH:mm", () => {
    expect(isValidTimeInput("00:00")).toBe(true);
    expect(isValidTimeInput("23:59")).toBe(true);
  });

  it("rejects out-of-range, unpadded and empty times", () => {
    expect(isValidTimeInput("24:00")).toBe(false);
    expect(isValidTimeInput("18:60")).toBe(false);
    expect(isValidTimeInput("6:30")).toBe(false);
    expect(isValidTimeInput("")).toBe(false);
  });
});

describe("combineLocalDateTimeToUtc", () => {
  it("round-trips with splitUtcToLocalDateTime in the runtime's timezone", () => {
    const iso = combineLocalDateTimeToUtc("2026-06-14", "20:30");
    expect(iso).not.toBeNull();
    expect(splitUtcToLocalDateTime(iso as string)).toEqual({ date: "2026-06-14", time: "20:30" });
  });

  it("round-trips boundary times", () => {
    for (const [date, time] of [
      ["2026-01-01", "00:00"],
      ["2026-12-31", "23:59"],
    ] as const) {
      const iso = combineLocalDateTimeToUtc(date, time);
      expect(iso).not.toBeNull();
      expect(splitUtcToLocalDateTime(iso as string)).toEqual({ date, time });
    }
  });

  it("rejects malformed dates", () => {
    expect(combineLocalDateTimeToUtc("2026-6-28", "18:30")).toBeNull();
    expect(combineLocalDateTimeToUtc("not-a-date", "18:30")).toBeNull();
    expect(combineLocalDateTimeToUtc("", "18:30")).toBeNull();
  });

  it("rejects malformed or out-of-range times", () => {
    expect(combineLocalDateTimeToUtc("2026-06-28", "24:00")).toBeNull();
    expect(combineLocalDateTimeToUtc("2026-06-28", "18:60")).toBeNull();
    expect(combineLocalDateTimeToUtc("2026-06-28", "6:30")).toBeNull();
    expect(combineLocalDateTimeToUtc("2026-06-28", "")).toBeNull();
  });
});

describe("parseLocalDate", () => {
  it("reads a real calendar day at local noon", () => {
    const date = parseLocalDate("2024-02-29");
    expect(date).not.toBeNull();
    expect(formatLocalDate(date as Date)).toBe("2024-02-29");
    expect(date?.getHours()).toBe(12);
  });

  it("rejects a day that would roll over into the next month", () => {
    expect(parseLocalDate("2025-02-31")).toBeNull();
    expect(parseLocalDate("2025-02-29")).toBeNull();
    expect(parseLocalDate("2025-13-01")).toBeNull();
    expect(parseLocalDate("2025-04-00")).toBeNull();
  });

  it("rejects malformed text", () => {
    expect(parseLocalDate("2025-2-3")).toBeNull();
    expect(parseLocalDate("")).toBeNull();
  });
});

describe("combineLocalDateTimeToUtc rollover", () => {
  it("rejects an impossible day", () => {
    expect(combineLocalDateTimeToUtc("2025-02-31", "10:00")).toBeNull();
    expect(combineLocalDateTimeToUtc("2025-13-01", "10:00")).toBeNull();
  });
});

describe("parseOptionalLocalInstant", () => {
  it("treats two blank parts as no instant", () => {
    expect(parseOptionalLocalInstant("", "")).toEqual({ instant: null, incomplete: false });
  });

  it("flags a touched but unusable pair as incomplete", () => {
    expect(parseOptionalLocalInstant("2026-06-14", "")).toEqual({
      instant: null,
      incomplete: true,
    });
    expect(parseOptionalLocalInstant("", "20:30")).toEqual({ instant: null, incomplete: true });
    expect(parseOptionalLocalInstant("2025-02-31", "20:30")).toEqual({
      instant: null,
      incomplete: true,
    });
  });

  it("returns the instant for a complete pair", () => {
    const { instant, incomplete } = parseOptionalLocalInstant("2026-06-14", "20:30");
    expect(incomplete).toBe(false);
    expect(splitUtcToLocalDateTime(instant as string)).toEqual({
      date: "2026-06-14",
      time: "20:30",
    });
  });
});

describe("sameInstant", () => {
  it("compares nullable instants", () => {
    expect(sameInstant(null, null)).toBe(true);
    expect(sameInstant("2026-06-14T18:30:00.000Z", null)).toBe(false);
    expect(sameInstant(null, "2026-06-14T18:30:00.000Z")).toBe(false);
  });

  it("matches the same instant written two ways", () => {
    expect(sameInstant("2026-06-14T18:30:00.000Z", "2026-06-14T20:30:00+02:00")).toBe(true);
    expect(sameInstant("2026-06-14T18:30:00.000Z", "2026-06-14T18:31:00.000Z")).toBe(false);
  });
});

describe("localTimeZoneLabel", () => {
  it("returns the runtime's IANA zone", () => {
    expect(localTimeZoneLabel()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
