import { describe, expect, it } from "vitest";

import { historySummary, newestFirst } from "./card-record-summaries";

describe("historySummary", () => {
  const now = new Date("2026-10-26T12:00:00.000Z");

  it("reads the newest event, whatever the order", () => {
    expect(
      historySummary(
        [{ createdAt: "2026-10-26T10:00:00.000Z" }, { createdAt: "2026-10-20T12:00:00.000Z" }],
        now,
      ),
    ).toBe("Updated 2h ago");
  });

  it("names the newest event when it carries a label", () => {
    expect(
      historySummary(
        [
          { label: "Created", createdAt: "2026-10-24T12:00:00.000Z" },
          { label: "Photo uploaded", createdAt: "2026-10-25T12:00:00.000Z" },
        ],
        now,
      ),
    ).toBe("Photo uploaded 1d ago");
  });

  it("is empty without events", () => {
    expect(historySummary([], now)).toBeUndefined();
  });
});

describe("newestFirst", () => {
  it("orders events by time, newest first", () => {
    const events = [
      { id: "a", createdAt: "2026-10-26T08:00:00.000Z" },
      { id: "b", createdAt: "2026-10-26T10:00:00.000Z" },
      { id: "c", createdAt: "2026-10-26T09:00:00.000Z" },
    ];
    expect(newestFirst(events).map((event) => event.id)).toEqual(["b", "c", "a"]);
  });
});
