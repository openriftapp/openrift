import { afterAll, describe, expect, it } from "vitest";

import { createDbContext } from "../../../test/integration-context.js";
import { slugTaxonomyRepo } from "./slug-taxonomy.js";

const ctx = createDbContext(crypto.randomUUID());

const TAG = `sti-${crypto.randomUUID().slice(0, 8)}`;
const slugOf = (name: string) => `${TAG}-${name}`;

describe.skipIf(!ctx)("slugTaxonomyRepo (integration)", () => {
  const { db } = ctx!;
  const isInUse = () => Promise.resolve(undefined);
  const finishes = slugTaxonomyRepo(db, { table: "finishes", isInUse });
  const rarities = slugTaxonomyRepo(db, { table: "rarities", isInUse });

  afterAll(async () => {
    await db.deleteFrom("finishes").where("slug", "like", `${TAG}-%`).execute();
    await db.deleteFrom("rarities").where("slug", "like", `${TAG}-%`).execute();
  });

  it("creates a row at sort order 0, never well-known, and reads it back by slug", async () => {
    const created = await finishes.create({ slug: slugOf("etched"), label: "Etched" });

    expect(created).toEqual({
      slug: slugOf("etched"),
      label: "Etched",
      sortOrder: 0,
      isWellKnown: false,
    });
    expect(await finishes.getBySlug(slugOf("etched"))).toEqual(created);
    expect(await finishes.getBySlug(slugOf("missing"))).toBeUndefined();
  });

  it("honors an explicit sort order and the extra color column", async () => {
    const created = await rarities.create({
      slug: slugOf("mythic"),
      label: "Mythic",
      color: "#CB212D",
      sortOrder: 7,
    });

    expect(created).toMatchObject({ sortOrder: 7, color: "#CB212D", isWellKnown: false });
  });

  it("updates only the fields it is given", async () => {
    await rarities.update(slugOf("mythic"), { color: null });

    expect(await rarities.getBySlug(slugOf("mythic"))).toMatchObject({
      label: "Mythic",
      color: null,
      sortOrder: 7,
    });
  });

  it("reorders the given rows to 0-based positions within its own table", async () => {
    await finishes.create({ slug: slugOf("foil"), label: "Foil" });

    await finishes.reorder([slugOf("foil"), slugOf("etched")]);

    const [foil, etched, mythic] = await Promise.all([
      finishes.getBySlug(slugOf("foil")),
      finishes.getBySlug(slugOf("etched")),
      rarities.getBySlug(slugOf("mythic")),
    ]);
    expect([foil?.sortOrder, etched?.sortOrder, mythic?.sortOrder]).toEqual([0, 1, 7]);
  });

  it("deletes by slug and reports whether a row went", async () => {
    expect(await finishes.deleteBySlug(slugOf("foil"))).toBe(true);
    expect(await finishes.deleteBySlug(slugOf("foil"))).toBe(false);
    expect(await finishes.getBySlug(slugOf("foil"))).toBeUndefined();
  });
});
