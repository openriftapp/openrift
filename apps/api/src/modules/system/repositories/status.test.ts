import { describe, expect, it, vi } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { statusRepo } from "./status.js";

const warn = vi.hoisted(() => vi.fn());
vi.mock("@openrift/shared/logger", () => ({ createLogger: () => ({ warn }) }));

describe("statusRepo.getPricingStats", () => {
  it("pairs each marketplace's product counts with its own price aggregate", async () => {
    const db = createMockDb([
      {
        marketplace: "cardmarket",
        products: 12,
        variants: 30,
        prices: 7,
        latestPrice: "2026-08-15 00:00:00+00",
      },
    ]);

    const stats = await statusRepo(db).getPricingStats();

    expect(stats).toEqual({
      totalPrices: 7,
      sources: [
        {
          marketplace: "cardmarket",
          products: 12,
          variants: 30,
          prices: 7,
          latestPrice: "2026-08-15 00:00:00+00",
        },
      ],
    });
  });

  it("returns an empty result when no marketplace has products", async () => {
    const stats = await statusRepo(createMockDb([])).getPricingStats();

    expect(stats).toEqual({ totalPrices: 0, sources: [] });
  });
});

describe("statusRepo.getDatabaseStatus", () => {
  it("logs the failure behind an unreachable status", async () => {
    const failure = new Error("permission denied for table kysely_migration");
    const recorded = createRecordingDb([[{ size_mb: 12 }], [{ count: 3 }], failure]);

    const status = await statusRepo(recorded.db).getDatabaseStatus();

    expect(status.status).toBe("unreachable");
    expect(warn).toHaveBeenCalledWith({ err: failure }, "database status query failed");
  });
});
