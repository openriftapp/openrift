import { describe, expect, it } from "vitest";

import type { OverlaySnapshot } from "./overlay-snapshot";
import { listNames, relativeAge, snapshotStatus } from "./overlay-status";

const NOW = new Date("2026-09-09T12:00:00.000Z");

function snapshot(overrides: Partial<OverlaySnapshot> = {}): OverlaySnapshot {
  return {
    lists: [{ id: "0199a0f2-0000-7000-8000-000000000001", name: "Summoner Skirmish wants" }],
    marketplace: "cardmarket",
    generatedAt: "2026-09-09T11:00:00.000Z",
    capturedAt: "2026-09-09T11:00:00.000Z",
    products: {
      "1": { owned: 2, wanted: 1, priceCents: null },
      "2": { owned: 0, wanted: 3, priceCents: null },
    },
    ...overrides,
  };
}

describe("relativeAge", () => {
  it("reads anything under a minute as just now", () => {
    expect(relativeAge("2026-09-09T11:59:30.000Z", NOW)).toBe("just now");
  });

  it("singularises one minute and one hour", () => {
    expect(relativeAge("2026-09-09T11:59:00.000Z", NOW)).toBe("1 minute ago");
    expect(relativeAge("2026-09-09T11:00:00.000Z", NOW)).toBe("1 hour ago");
  });

  it("counts whole days past 24 hours", () => {
    expect(relativeAge("2026-09-06T09:00:00.000Z", NOW)).toBe("3 days ago");
  });

  it("treats an unparseable timestamp as just now", () => {
    expect(relativeAge("not a date", NOW)).toBe("just now");
  });
});

describe("listNames", () => {
  it("names up to three lists in full", () => {
    expect(listNames(["Wants"])).toBe("Wants");
    expect(listNames(["Wants", "Playset", "Foils"])).toBe("Wants, Playset, Foils");
  });

  it("counts the rest past three", () => {
    expect(listNames(["Wants", "Playset", "Foils", "Runes", "Promos"])).toBe(
      "Wants, Playset, Foils and 2 more",
    );
  });
});

describe("snapshotStatus", () => {
  it("asks for a first fetch when nothing is stored", () => {
    const status = snapshotStatus(undefined, NOW);
    expect(status.headline).toBe("No counts yet");
    expect(status.action).toBe("Get my counts");
    expect(status.stale).toBe(true);
  });

  it("leads with the age and offers a refresh", () => {
    const status = snapshotStatus(snapshot(), NOW);
    expect(status.headline).toBe("Counts from 1 hour ago");
    expect(status.action).toBe("Refresh counts");
    expect(status.stale).toBe(false);
  });

  it("names every picked list and counts only what the viewer owns or wants", () => {
    const two = snapshot({
      lists: [
        { id: "0199a0f2-0000-7000-8000-000000000001", name: "Wants" },
        { id: "0199a0f2-0000-7000-8000-000000000002", name: "Playset" },
      ],
      products: {
        "1": { owned: 2, wanted: 1, priceCents: 100 },
        "2": { owned: 0, wanted: 0, priceCents: 250 },
      },
    });
    expect(two && snapshotStatus(two, NOW).detail).toBe("Wants, Playset · 1 card you own or want");
  });

  it("marks counts older than two days as stale", () => {
    const old = snapshot({ capturedAt: "2026-09-06T12:00:00.000Z" });
    const status = snapshotStatus(old, NOW);
    expect(status.stale).toBe(true);
    expect(status.headline).toBe("Counts from 3 days ago");
  });
});
