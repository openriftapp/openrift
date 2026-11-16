import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readAnnotateReport, snapshotChange } from "./inject";
import { SNAPSHOT_STORAGE_KEY } from "./overlay-snapshot";

type StorageListener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

const fake = vi.hoisted(() => {
  const listeners = new Set<StorageListener>();
  return {
    listeners,
    browser: {
      storage: {
        onChanged: {
          addListener: (listener: StorageListener) => listeners.add(listener),
          removeListener: (listener: StorageListener) => listeners.delete(listener),
        },
      },
    },
  };
});

vi.mock("wxt/browser", () => ({ browser: fake.browser }));

function storeSnapshot(capturedAt: string, area = "local"): void {
  for (const listener of fake.listeners) {
    listener({ [SNAPSHOT_STORAGE_KEY]: { newValue: { capturedAt } } }, area);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  fake.listeners.clear();
});

describe("snapshotChange", () => {
  it("resolves as soon as a snapshot with a new capture time is stored", async () => {
    const changed = snapshotChange("2026-09-09T11:00:00.000Z", 20_000);

    storeSnapshot("2026-09-09T11:00:00.000Z");
    storeSnapshot("2026-09-09T11:05:00.000Z", "sync");
    storeSnapshot("2026-09-09T11:05:00.000Z");

    await expect(changed).resolves.toBe(true);
    expect(fake.listeners.size).toBe(0);
  });

  it("gives up after the timeout and stops listening", async () => {
    const changed = snapshotChange(undefined, 20_000);

    vi.advanceTimersByTime(20_000);

    await expect(changed).resolves.toBe(false);
    expect(fake.listeners.size).toBe(0);
  });
});

describe("readAnnotateReport", () => {
  it("keeps a report with or without a marked count", () => {
    expect(readAnnotateReport({ rows: 4, resolved: 3, annotated: 2 })).toEqual({
      rows: 4,
      resolved: 3,
      annotated: 2,
    });
    expect(readAnnotateReport({ rows: 4, resolved: 3 })).toEqual({ rows: 4, resolved: 3 });
  });

  it("drops a result that did not survive injection", () => {
    expect(readAnnotateReport(undefined)).toBeUndefined();
    expect(readAnnotateReport(3)).toBeUndefined();
    expect(readAnnotateReport({ rows: "4" })).toBeUndefined();
  });
});
