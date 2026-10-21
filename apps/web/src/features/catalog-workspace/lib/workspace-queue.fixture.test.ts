import { workspaceQueueResponseSchema } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it } from "vitest";

import { workspaceQueueFixture } from "./workspace-queue.fixture";

describe("workspaceQueueFixture", () => {
  it("matches the queue response contract", () => {
    expect(workspaceQueueResponseSchema.safeParse(workspaceQueueFixture).success).toBe(true);
  });

  it("counts match the items per owner and segment", () => {
    for (const owner of ["card", "face", "printing"] as const) {
      const items = workspaceQueueFixture.items.filter((item) => item.owner === owner);
      expect(items.filter((item) => item.segment === "open")).toHaveLength(
        workspaceQueueFixture.counts[owner].open,
      );
      expect(items.filter((item) => item.segment === "new")).toHaveLength(
        workspaceQueueFixture.counts[owner].new,
      );
    }
  });
});
