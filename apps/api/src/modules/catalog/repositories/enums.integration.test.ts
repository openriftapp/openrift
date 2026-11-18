import { afterAll, describe, expect, it } from "vitest";

import { createDbContext } from "../../../test/integration-context.js";
import { enumsRepo } from "./enums.js";

const ctx = createDbContext(crypto.randomUUID());

const SLUG = `eni-${crypto.randomUUID().slice(0, 8)}`;

describe.skipIf(!ctx)("enumsRepo.contentVersion (integration)", () => {
  const { db } = ctx!;
  const repo = enumsRepo(db);

  afterAll(async () => {
    await db.deleteFrom("graders").where("slug", "=", SLUG).execute();
    await db.deleteFrom("finishes").where("slug", "=", SLUG).execute();
  });

  it("rolls when a table without a catalog version trigger changes", async () => {
    const before = await repo.contentVersion();

    await db
      .insertInto("graders")
      .values({ slug: SLUG, label: "Piltover Grading", sortOrder: 99 })
      .execute();

    expect(await repo.contentVersion()).not.toBe(before);
  });

  it("rolls when the catalog version moves", async () => {
    const before = await repo.contentVersion();

    await db
      .insertInto("finishes")
      .values({ slug: SLUG, label: "Hextech Foil", sortOrder: 99 })
      .execute();

    expect(await repo.contentVersion()).not.toBe(before);
  });
});
