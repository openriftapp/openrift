import { describe, expect, it, vi } from "vitest";

import type * as QueryHelpers from "../../../repositories/query-helpers.js";
import { lockKey } from "../../../repositories/query-helpers.js";
import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { ingestRepo } from "./ingest.js";

vi.mock("../../../repositories/query-helpers.js", async (importOriginal) => ({
  ...(await importOriginal<typeof QueryHelpers>()),
  lockKey: vi.fn(() => Promise.resolve()),
}));

describe("ingestRepo", () => {
  it("locks card and meta submissions of one user on one namespaced key", async () => {
    const db = createMockDb([]);
    await ingestRepo(db).lockCardAndMetaSubmissions("user-7");
    expect(lockKey).toHaveBeenCalledWith(db, "card-and-meta-submissions:user-7");
  });

  it("insertCandidateCard returns inserted ID", async () => {
    const db = createMockDb([{ id: "cc-new" }]);
    expect(
      await ingestRepo(db).insertCandidateCard({
        provider: "test",
        externalId: "ext-1",
        name: "New",
        types: ["unit"],
        superTypes: [],
        domains: ["fury"],
        tags: [],
      }),
    ).toBe("cc-new");
  });

  it.each([
    {
      name: "deleteCandidateCards",
      run: (repo: ReturnType<typeof ingestRepo>) => repo.deleteCandidateCards([]),
    },
    {
      name: "deleteCandidatePrintings",
      run: (repo: ReturnType<typeof ingestRepo>) => repo.deleteCandidatePrintings([]),
    },
  ])("$name issues no query for an empty id list", async ({ run }) => {
    const { db, queries } = createRecordingDb();
    await run(ingestRepo(db));
    expect(queries).toEqual([]);
  });
});
