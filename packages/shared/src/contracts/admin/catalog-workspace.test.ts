import { describe, expect, it } from "vitest";

import { workspaceRecordsInputSchema } from "./catalog-workspace.js";

describe("workspaceRecordsInputSchema", () => {
  it("accepts a row offset cursor", () => {
    expect(workspaceRecordsInputSchema.safeParse({ kind: "printing", cursor: "200" }).success).toBe(
      true,
    );
  });

  it("rejects a cursor past any real offset", () => {
    expect(
      workspaceRecordsInputSchema.safeParse({ kind: "printing", cursor: "99999999999999999999" })
        .success,
    ).toBe(false);
  });
});
