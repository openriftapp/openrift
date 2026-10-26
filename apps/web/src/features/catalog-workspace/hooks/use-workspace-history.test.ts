import type { WorkspaceEvent } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it } from "vitest";

import { historySummary, newestFirst, workspaceHistoryQueryOptions } from "./use-workspace-history";

function event(id: string, label: string, createdAt: string): WorkspaceEvent {
  return {
    id,
    action: "printing.update",
    label,
    entityType: "printing",
    entityId: "p1",
    cardSlug: "jinx",
    createdAt,
  };
}

const NOW = new Date("2026-10-26T12:00:00.000Z");

describe("newestFirst", () => {
  it("orders events by time, newest first", () => {
    const events = [
      event("a", "Created", "2026-10-24T12:00:00.000Z"),
      event("b", "Changed size", "2026-10-26T10:00:00.000Z"),
    ];
    expect(newestFirst(events).map((entry) => entry.id)).toEqual(["b", "a"]);
  });
});

describe("historySummary", () => {
  it("names the newest event and how long ago it happened", () => {
    const events = [
      event("a", "Created", "2026-10-24T12:00:00.000Z"),
      event("b", "Photo uploaded", "2026-10-25T12:00:00.000Z"),
    ];
    expect(historySummary(events, NOW)).toBe("Photo uploaded 1d ago");
  });

  it("is empty without events", () => {
    expect(historySummary([], NOW)).toBeUndefined();
  });
});

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
