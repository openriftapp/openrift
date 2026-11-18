import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { marketplaceMappingRepo } from "./marketplace-mapping.js";

describe("marketplaceMappingRepo", () => {
  it("deleteVariantById deletes a variant (parent product left behind)", async () => {
    const db = createMockDb({ numDeletedRows: 1n });
    await expect(marketplaceMappingRepo(db).deleteVariantById("var-1")).resolves.toBe(true);
  });
});
