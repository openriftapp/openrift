import { describe, expect, it, vi } from "vitest";

import type * as QueryHelpers from "../../../repositories/query-helpers.js";
import { lockKey } from "../../../repositories/query-helpers.js";
import { createMockDb } from "../../../test/mock-db.js";
import { lockTournamentWrites } from "./tournaments-shared.js";

vi.mock("../../../repositories/query-helpers.js", async (importOriginal) => ({
  ...(await importOriginal<typeof QueryHelpers>()),
  lockKey: vi.fn(() => Promise.resolve()),
}));

describe("lockTournamentWrites", () => {
  it("locks on a namespaced tournament key", async () => {
    const db = createMockDb([]);
    await lockTournamentWrites(db, "t-1");
    expect(lockKey).toHaveBeenCalledWith(db, "tournament-writes:t-1");
  });
});
