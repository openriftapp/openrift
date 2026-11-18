import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { slugTaxonomyRepo } from "./slug-taxonomy.js";

const captured = createRecordingDb();
const { db } = captured;

const isInUse = vi.fn(() => Promise.resolve(undefined));

const plainRepo = () => slugTaxonomyRepo(db, { table: "finishes", isInUse });

describe("slugTaxonomyRepo", () => {
  beforeEach(() => {
    captured.reset();
    isInUse.mockClear();
  });

  it("delegates isInUse to the caller-supplied lookup", async () => {
    await plainRepo().isInUse("normal");

    expect(isInUse).toHaveBeenCalledWith("normal");
    expect(captured.statements).toHaveLength(0);
  });

  it("skips the reorder statement for an empty slug list", async () => {
    await plainRepo().reorder([]);

    expect(captured.statements).toHaveLength(0);
  });
});
