import { describe, expect, it } from "vitest";

import {
  deskPrintingPeriod,
  deskPrintingRelease,
  deskPrintingStatus,
} from "./printing-desk-status";

const TODAY = "2026-09-07";

describe("deskPrintingStatus", () => {
  it("has no status when neither the printing nor its set has a date", () => {
    expect(deskPrintingStatus({ releasedAt: null, releasePrecision: null }, TODAY)).toBeNull();
  });

  it("is announced when only an announcement date is set", () => {
    expect(
      deskPrintingStatus(
        { releasedAt: null, releasePrecision: null, announcedAt: "2026-08-01" },
        TODAY,
      ),
    ).toBe("announced");
  });

  it("falls back to the set release when the printing has no date of its own", () => {
    const row = { releasedAt: null, releasePrecision: null };
    expect(
      deskPrintingStatus(
        { ...row, setReleasedAt: "2025-10-31", setReleasePrecision: "day" },
        TODAY,
      ),
    ).toBe("released");
    expect(
      deskPrintingStatus(
        { ...row, setReleasedAt: "2027-01-01", setReleasePrecision: "year" },
        TODAY,
      ),
    ).toBe("announced");
  });

  it("lets the printing's own date win over the set release", () => {
    expect(
      deskPrintingStatus(
        {
          releasedAt: "2026-12-01",
          releasePrecision: "day",
          setReleasedAt: "2025-10-31",
          setReleasePrecision: "day",
        },
        TODAY,
      ),
    ).toBe("announced");
  });

  it("is announced when a date is set but the precision is missing", () => {
    expect(deskPrintingStatus({ releasedAt: "2026-01-01", releasePrecision: null }, TODAY)).toBe(
      "announced",
    );
  });

  it("is released once a day-precise date has passed", () => {
    expect(deskPrintingStatus({ releasedAt: "2026-09-06", releasePrecision: "day" }, TODAY)).toBe(
      "released",
    );
  });

  it("is released on the day itself", () => {
    expect(deskPrintingStatus({ releasedAt: TODAY, releasePrecision: "day" }, TODAY)).toBe(
      "released",
    );
  });

  it("is announced while a day-precise date is still ahead", () => {
    expect(deskPrintingStatus({ releasedAt: "2026-09-08", releasePrecision: "day" }, TODAY)).toBe(
      "announced",
    );
  });

  it("waits for a month period to run out before calling it released", () => {
    expect(deskPrintingStatus({ releasedAt: "2026-09-01", releasePrecision: "month" }, TODAY)).toBe(
      "announced",
    );
    expect(deskPrintingStatus({ releasedAt: "2026-08-01", releasePrecision: "month" }, TODAY)).toBe(
      "released",
    );
  });

  it("waits for a year period to run out", () => {
    expect(deskPrintingStatus({ releasedAt: "2026-01-01", releasePrecision: "year" }, TODAY)).toBe(
      "announced",
    );
    expect(deskPrintingStatus({ releasedAt: "2025-01-01", releasePrecision: "year" }, TODAY)).toBe(
      "released",
    );
  });
});

describe("deskPrintingRelease", () => {
  it("renames the row's precision field onto the shared release shape", () => {
    expect(deskPrintingRelease({ releasedAt: "2026-03-01", releasePrecision: "month" })).toEqual({
      releasedAt: "2026-03-01",
      precision: "month",
    });
  });
});

describe("deskPrintingPeriod", () => {
  it("reads TBA when there is no date", () => {
    expect(deskPrintingPeriod({ releasedAt: null, releasePrecision: null })).toBe("TBA");
  });

  it("marks a period taken from the set", () => {
    expect(
      deskPrintingPeriod({
        releasedAt: null,
        releasePrecision: null,
        setReleasedAt: "2025-10-31",
        setReleasePrecision: "day",
      }),
    ).toBe("2025-10-31 (set release)");
  });

  it("shows the period at the stated precision", () => {
    expect(deskPrintingPeriod({ releasedAt: "2026-03-01", releasePrecision: "month" })).toBe(
      "2026-03",
    );
    expect(deskPrintingPeriod({ releasedAt: "2026-03-14", releasePrecision: "day" })).toBe(
      "2026-03-14",
    );
    expect(deskPrintingPeriod({ releasedAt: "2026-01-01", releasePrecision: "year" })).toBe("2026");
  });
});
