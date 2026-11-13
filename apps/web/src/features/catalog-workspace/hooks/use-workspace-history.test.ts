import { describe, expect, it } from "vitest";

import { workspaceHistoryQueryOptions } from "./use-workspace-history";

describe("workspaceHistoryQueryOptions", () => {
  it("keys the history under the workspace prefix so every workspace mutation refreshes it", () => {
    expect(workspaceHistoryQueryOptions({ faceId: "f1" }).queryKey).toEqual([
      "admin",
      "workspace",
      "history",
      { faceId: "f1" },
    ]);
  });
});
