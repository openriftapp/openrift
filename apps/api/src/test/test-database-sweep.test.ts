import { describe, expect, it } from "vitest";

import { selectDroppableTestDatabases, STALE_TEST_DB_AGE_MS } from "./integration-setup.js";

const NOW = 1_782_885_425_522;
const HOUR_MS = 60 * 60 * 1000;

function name(label: string, createdAt: number): string {
  return `openrift_test_${label}_${createdAt}`;
}

describe("selectDroppableTestDatabases", () => {
  it("keeps an e2e database older than the age cutoff while a session is open on it", () => {
    const liveE2e = { name: name("e2e", NOW - 2 * HOUR_MS), connections: 4 };
    const leftover = { name: name("shared", NOW - 2 * HOUR_MS), connections: 0 };

    expect(selectDroppableTestDatabases([liveE2e, leftover], STALE_TEST_DB_AGE_MS, NOW)).toEqual([
      leftover.name,
    ]);
  });

  it("keeps an idle database younger than the age cutoff", () => {
    const fresh = { name: name("shared", NOW - 5 * 60 * 1000), connections: 0 };

    expect(selectDroppableTestDatabases([fresh], STALE_TEST_DB_AGE_MS, NOW)).toEqual([]);
  });

  it("keeps a database whose name carries no timestamp", () => {
    const unnamed = { name: "openrift_test_scratch", connections: 0 };

    expect(selectDroppableTestDatabases([unnamed], STALE_TEST_DB_AGE_MS, NOW)).toEqual([]);
  });
});
