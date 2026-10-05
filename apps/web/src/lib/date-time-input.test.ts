import { describe, expect, it } from "vitest";

import {
  combineLocalDateTimeToUtc,
  isValidTimeInput,
  localTimeZoneLabel,
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

describe("localTimeZoneLabel", () => {
  it("returns the runtime's IANA zone", () => {
    expect(localTimeZoneLabel()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
