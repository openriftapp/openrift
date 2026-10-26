import { describe, expect, it, vi } from "vitest";

import type { AdminAccess } from "../../../middleware/require-admin.js";
import { listWorkspaceHistory } from "./workspace-history.js";
import type { WorkspaceRepos } from "./workspace-queue.js";

const ADMIN: AdminAccess = { isAdmin: true, sections: [] };
const DESK: AdminAccess = { isAdmin: false, sections: ["printing-desk"] };
const T1 = new Date("2026-10-21T09:00:00.000Z");

const EVENT = {
  id: "event-1",
  action: "printing.accept-field",
  entityType: "printing",
  entityId: "promo",
  entityLabel: "OGN-030",
  cardSlug: null,
  createdAt: T1,
};

function makeRepos() {
  return {
    workspaceRecords: {
      printingFaceIds: vi.fn((id: string) =>
        Promise.resolve(id === "missing" ? null : [`face-${id}`]),
      ),
      facePrintingIds: vi.fn().mockResolvedValue(["base", "promo"]),
      faceExists: vi.fn((id: string) => Promise.resolve(id !== "missing")),
      eventsOnPrintings: vi.fn().mockResolvedValue([EVENT]),
      anyInDeskScope: vi.fn((ids: string[]) =>
        Promise.resolve(ids.some((id) => id === "promo" || id === "own")),
      ),
    },
  };
}

function history(
  repos: ReturnType<typeof makeRepos>,
  access: AdminAccess,
  input: { printingId?: string; faceId?: string },
) {
  return listWorkspaceHistory(repos as unknown as WorkspaceRepos, {
    access,
    userId: "user-1",
    input,
  });
}

describe("listWorkspaceHistory", () => {
  it("reads a printing's events with its faces for an admin", async () => {
    const repos = makeRepos();
    const response = await history(repos, ADMIN, { printingId: "base" });
    expect(response.events).toEqual([
      expect.objectContaining({ id: "event-1", label: "OGN-030", createdAt: T1.toISOString() }),
    ]);
    expect(repos.workspaceRecords.eventsOnPrintings).toHaveBeenCalledWith(
      ["base"],
      ["face-base"],
      200,
      undefined,
    );
    expect(repos.workspaceRecords.anyInDeskScope).not.toHaveBeenCalled();
  });

  it("reads a face's events across every printing using it", async () => {
    const repos = makeRepos();
    await history(repos, ADMIN, { faceId: "face-1" });
    expect(repos.workspaceRecords.eventsOnPrintings).toHaveBeenCalledWith(
      ["base", "promo"],
      ["face-1"],
      200,
      undefined,
    );
  });

  it("rejects an unknown printing or face", async () => {
    await expect(history(makeRepos(), ADMIN, { printingId: "missing" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(history(makeRepos(), ADMIN, { faceId: "missing" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("lets a desk holder read promo and own printings", async () => {
    await expect(history(makeRepos(), DESK, { printingId: "promo" })).resolves.toBeDefined();
    await expect(history(makeRepos(), DESK, { printingId: "own" })).resolves.toBeDefined();
    await expect(history(makeRepos(), DESK, { faceId: "face-1" })).resolves.toBeDefined();
  });

  it("limits a desk holder to their own events", async () => {
    const repos = makeRepos();
    await history(repos, DESK, { printingId: "promo" });
    expect(repos.workspaceRecords.eventsOnPrintings).toHaveBeenCalledWith(
      ["promo"],
      ["face-promo"],
      200,
      "user-1",
    );
  });

  it("forbids a desk holder any other printing", async () => {
    await expect(history(makeRepos(), DESK, { printingId: "base" })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("returns no events for a face without a printing in the desk holder's scope", async () => {
    const repos = makeRepos();
    repos.workspaceRecords.facePrintingIds.mockResolvedValue(["base"]);
    await expect(history(repos, DESK, { faceId: "face-1" })).resolves.toEqual({ events: [] });
    expect(repos.workspaceRecords.eventsOnPrintings).not.toHaveBeenCalled();
  });
});
