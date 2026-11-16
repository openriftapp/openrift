import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { marketplaceCollectionValueHistoryRepo } from "./marketplace-collection-value-history.js";

const USER_ID = "user-1";
const GROUP_COLLECTION_ID = "a0000000-0001-4000-a000-000000000010";

async function eventQuery(collectionIds: string[] | null) {
  const recorded = createRecordingDb();
  await marketplaceCollectionValueHistoryRepo(recorded.db).collectionValueTimeSeries({
    userId: USER_ID,
    marketplace: "tcgplayer",
    collectionIds,
    cutoff: null,
    scope: {},
  });
  const sql = (recorded.queries[1] ?? "").replaceAll(/\s+/gu, " ");
  return { sql, parameters: recorded.parameters[1] ?? [] };
}

describe("collectionValueTimeSeries event walk", () => {
  it("walks back every member's events in the selected collections", async () => {
    const { sql, parameters } = await eventQuery([GROUP_COLLECTION_ID]);

    expect(sql).toContain("ce.to_collection_id IN");
    expect(sql).toContain("ce.from_collection_id IN");
    expect(sql).not.toContain("ce.user_id =");
    expect(parameters).toContain(GROUP_COLLECTION_ID);
    expect(parameters).not.toContain(USER_ID);
  });

  it("walks back only the viewer's own events across all collections", async () => {
    const { sql, parameters } = await eventQuery(null);

    expect(sql).toContain("ce.user_id =");
    expect(parameters).toContain(USER_ID);
  });
});
