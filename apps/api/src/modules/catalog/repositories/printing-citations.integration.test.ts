import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededPrinting } from "../../../test/catalog-seed.js";
import { seedCatalogPrinting } from "../../../test/catalog-seed.js";
import { createDbContext } from "../../../test/integration-context.js";
import { printingCitationsRepo } from "./printing-citations.js";

const ctx = createDbContext(crypto.randomUUID());

describe.skipIf(!ctx)("printingCitationsRepo (integration)", () => {
  const { db } = ctx!;
  const repo = printingCitationsRepo(db);
  let seeded: SeededPrinting;
  let other: SeededPrinting;

  beforeAll(async () => {
    seeded = await seedCatalogPrinting(db, "pci");
    other = await seedCatalogPrinting(db, "pci");
  });

  afterAll(async () => {
    await seeded.cleanup();
    await other.cleanup();
  });

  it("starts a printing's first citation at zero and appends past the highest", async () => {
    const first = await repo.insert({
      printingId: seeded.printingId,
      label: "VOD",
      sourceUrl: null,
    });
    const second = await repo.insert({
      printingId: seeded.printingId,
      label: "Spoiler",
      sourceUrl: "https://example.test/spoiler",
    });

    expect([first.sortOrder, second.sortOrder]).toEqual([0, 1]);
  });

  it("gives concurrent inserts distinct sort orders", async () => {
    const rows = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        repo.insert({ printingId: other.printingId, label: `Race ${index}`, sourceUrl: null }),
      ),
    );

    expect(rows.map((row) => row.sortOrder).toSorted()).toEqual([0, 1, 2, 3]);
  });

  it("lists one printing's citations in display order, ties broken by id", async () => {
    await db
      .updateTable("printingCitations")
      .set({ sortOrder: 0 })
      .where("printingId", "=", seeded.printingId)
      .execute();

    const listed = await repo.listForPrinting(seeded.printingId);
    const ids = listed.map((row) => row.id);

    expect(ids).toEqual(ids.toSorted());
    expect(listed.every((row) => row.printingId === seeded.printingId)).toBe(true);
  });

  it("lists a batch of printings in display order", async () => {
    const listed = await repo.listForPrintingIds([seeded.printingId, other.printingId]);
    const keys = listed.map((row) => [row.sortOrder, row.id] as const);

    expect(listed).toHaveLength(6);
    expect(keys).toEqual(
      keys.toSorted(([orderA, idA], [orderB, idB]) =>
        orderA === orderB ? (idA < idB ? -1 : 1) : orderA - orderB,
      ),
    );
  });

  it("updates only the fields it is sent and keeps the sort order", async () => {
    const [citation] = await repo.listForPrinting(other.printingId);

    await repo.update(citation!.id, { sourceUrl: "https://web.archive.org/x" });
    await repo.update(citation!.id, { sourceUrl: null });

    const listed = await repo.listForPrinting(other.printingId);
    const after = listed.find((row) => row.id === citation!.id);
    expect(after).toEqual({ ...citation, sourceUrl: null });
  });
});
