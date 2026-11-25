import { afterAll, describe, expect, it } from "vitest";

import { createDbContext } from "../../../test/integration-context.js";
import { ignoredCandidatesRepo } from "./ignored-candidates.js";

const ctx = createDbContext("a0000000-0039-4000-a000-000000000001");

describe.skipIf(!ctx)("ignoredCandidatesRepo (integration)", () => {
  const { db } = ctx!;
  const repo = ignoredCandidatesRepo(db);

  afterAll(async () => {
    await db
      .deleteFrom("ignoredCandidateCards")
      .where("provider", "like", "test-prov-39%")
      .execute();
    await db
      .deleteFrom("ignoredCandidatePrintings")
      .where("provider", "like", "test-prov-39%")
      .execute();
  });

  it("ignoreCards inserts without error", async () => {
    await repo.ignoreCards([{ provider: "test-prov-39", externalId: "ext-card-1" }]);
  });

  it("ignoreCards is a no-op on conflict", async () => {
    await repo.ignoreCards([{ provider: "test-prov-39", externalId: "ext-card-1" }]);
  });

  it("listIgnoredCards returns all ignored cards", async () => {
    await repo.ignoreCards([
      { provider: "test-prov-39", externalId: "ext-card-2" },
      { provider: "test-prov-39", externalId: "ext-card-3" },
    ]);

    const list = await repo.listIgnoredCards();
    const ours = list.filter((c) => c.provider === "test-prov-39");
    expect(ours.length).toBeGreaterThanOrEqual(3);
  });

  it("unignoreCards removes only the listed cards", async () => {
    await repo.unignoreCards([
      { provider: "test-prov-39", externalId: "ext-card-2" },
      { provider: "test-prov-39", externalId: "ext-card-3" },
      { provider: "test-prov-39", externalId: "nonexistent" },
    ]);
    const list = await repo.listIgnoredCards();
    const left = list.filter((c) => c.provider === "test-prov-39").map((c) => c.externalId);
    expect(left).toEqual(["ext-card-1"]);
  });

  it("ignorePrinting inserts without error", async () => {
    await repo.ignorePrinting({
      provider: "test-prov-39",
      externalId: "ext-print-1",
      finish: "foil",
    });
  });

  it("ignorePrinting with null finish inserts without error", async () => {
    await repo.ignorePrinting({
      provider: "test-prov-39",
      externalId: "ext-print-2",
      finish: null,
    });
  });

  it("ignorePrinting is a no-op on conflict", async () => {
    await repo.ignorePrinting({
      provider: "test-prov-39",
      externalId: "ext-print-1",
      finish: "foil",
    });
  });

  it("listIgnoredPrintings returns all ignored printings", async () => {
    const list = await repo.listIgnoredPrintings();
    const ours = list.filter((p) => p.provider === "test-prov-39");
    expect(ours.length).toBeGreaterThanOrEqual(2);
  });

  it("unignorePrinting removes an ignored printing with specific finish", async () => {
    const result = await repo.unignorePrinting("test-prov-39", "ext-print-1", "foil");
    expect(result.numDeletedRows).toBe(1n);
  });

  it("unignorePrinting removes an ignored printing with null finish", async () => {
    const result = await repo.unignorePrinting("test-prov-39", "ext-print-2", null);
    expect(result.numDeletedRows).toBe(1n);
  });

  it("unignorePrinting returns 0 for nonexistent entry", async () => {
    const result = await repo.unignorePrinting("test-prov-39", "nonexistent", null);
    expect(result.numDeletedRows).toBe(0n);
  });
});
