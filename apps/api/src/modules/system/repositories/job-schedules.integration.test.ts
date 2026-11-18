import { afterAll, describe, expect, it } from "vitest";

import { createDbContext } from "../../../test/integration-context.js";
import { jobSchedulesRepo } from "./job-schedules.js";

const ctx = createDbContext("a0000000-0102-4000-a000-000000000001");

const KIND_A = "test.0102.alpha";
const KIND_B = "test.0102.bravo";
const KIND_C = "test.0102.charlie";

describe.skipIf(!ctx)("jobSchedulesRepo (integration)", () => {
  const { db } = ctx!;
  const repo = jobSchedulesRepo(db);

  afterAll(async () => {
    await db.deleteFrom("jobSchedules").where("kind", "in", [KIND_A, KIND_B, KIND_C]).execute();
  });

  it("upsert inserts a schedule that get returns", async () => {
    await repo.upsert(KIND_A, "0 3 * * *");

    expect(await repo.get(KIND_A)).toMatchObject({ kind: KIND_A, schedule: "0 3 * * *" });
  });

  it("upsert on an existing kind replaces the schedule and bumps updatedAt", async () => {
    const stale = new Date("2026-01-01T00:00:00Z");
    await repo.upsert(KIND_B, "0 3 * * *");
    await db
      .updateTable("jobSchedules")
      .set({ updatedAt: stale })
      .where("kind", "=", KIND_B)
      .execute();

    await repo.upsert(KIND_B, "*/15 * * * *");

    const row = await repo.get(KIND_B);
    expect(row?.schedule).toBe("*/15 * * * *");
    expect(row!.updatedAt.getTime()).toBeGreaterThan(stale.getTime());
  });

  it("listAll returns every schedule ordered by kind", async () => {
    await repo.upsert(KIND_C, "0 0 * * 0");
    await repo.remove(KIND_A);
    await repo.upsert(KIND_A, "0 3 * * *");

    const rows = await repo.listAll();

    const kinds = rows.map((row) => row.kind).filter((kind) => kind.startsWith("test.0102."));
    expect(kinds).toEqual([KIND_A, KIND_B, KIND_C]);
  });

  it("remove deletes only the given kind", async () => {
    await repo.upsert(KIND_A, "0 3 * * *");
    await repo.upsert(KIND_C, "0 0 * * 0");

    await repo.remove(KIND_A);

    expect(await repo.get(KIND_A)).toBeNull();
    expect(await repo.get(KIND_C)).not.toBeNull();
  });
});
