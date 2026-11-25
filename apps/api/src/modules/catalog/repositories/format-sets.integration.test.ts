import { WellKnown } from "@openrift/shared/well-known";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext } from "../../../test/integration-context.js";
import { formatSetsRepo } from "./format-sets.js";

const ctx = createDbContext("a0000000-0390-4000-a000-000000000001");
const STANDARD = WellKnown.banFormat.CONSTRUCTED;

describe.skipIf(!ctx)("formatSetsRepo (integration)", () => {
  const { db } = ctx!;
  const repo = formatSetsRepo(db);
  let setId = "";

  beforeAll(async () => {
    const set = await db
      .insertInto("sets")
      .values({ slug: "FMTSET-TEST", name: "Format Set Test", sortOrder: 990 })
      .returning("id")
      .executeTakeFirstOrThrow();
    setId = set.id;
  });

  afterAll(async () => {
    if (setId) {
      await db.deleteFrom("formatSets").where("setId", "=", setId).execute();
      await db.deleteFrom("sets").where("id", "=", setId).execute();
    }
  });

  it("updates the global window in place instead of adding a second one", async () => {
    await repo.upsert({
      formatId: STANDARD,
      setId,
      circuit: null,
      legalFrom: null,
      legalUntil: null,
    });
    const updated = await repo.upsert({
      formatId: STANDARD,
      setId,
      circuit: null,
      legalFrom: "2027-01-29",
      legalUntil: null,
    });

    expect(updated).toMatchObject({ setSlug: "FMTSET-TEST", legalFrom: "2027-01-29" });
    const rows = await db.selectFrom("formatSets").selectAll().where("setId", "=", setId).execute();
    expect(rows).toHaveLength(1);
  });

  it("keeps a circuit window apart from the global one", async () => {
    await repo.upsert({
      formatId: STANDARD,
      setId,
      circuit: "korea",
      legalFrom: null,
      legalUntil: null,
    });

    const all = await repo.listAll();
    const windows = all.filter((row) => row.setId === setId);
    expect(windows.map((row) => row.circuit)).toEqual([null, "korea"]);
    expect(await repo.remove({ formatId: STANDARD, setId, circuit: "korea" })).toBe(true);
    expect(await repo.remove({ formatId: STANDARD, setId, circuit: "korea" })).toBe(false);
  });

  it("refuses an end date without a start date", async () => {
    await expect(
      repo.upsert({
        formatId: STANDARD,
        setId,
        circuit: null,
        legalFrom: null,
        legalUntil: "2028-01-01",
      }),
    ).rejects.toThrow();
  });
});
