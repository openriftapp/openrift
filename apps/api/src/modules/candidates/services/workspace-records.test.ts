import { describe, expect, it, vi } from "vitest";

import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { WorkspaceRepos } from "./workspace-queue.js";
import { listWorkspaceRecords } from "./workspace-records.js";

const ADMIN: AdminAccess = { isAdmin: true, sections: [] };
const DESK: AdminAccess = { isAdmin: false, sections: ["printing-desk"] };
const T1 = new Date("2026-10-21T09:00:00.000Z");

function printing(id: string) {
  return {
    id,
    cardSlug: "jinx-loose-cannon",
    cardName: "Jinx, Loose Cannon",
    setName: "Origins",
    shortCode: "OGN-030",
    publicCode: "OGN-030/298",
    language: "EN",
    finish: "normal",
    imageUrl: null,
    faceCount: 1,
    isDoubleSided: false,
    imageCount: 0,
    markers: [],
    channelLabel: null,
    status: null,
    updatedAt: T1,
  };
}

function makeRepos() {
  return {
    workspaceRecords: {
      listPrintingRecords: vi.fn().mockResolvedValue({
        rows: [printing("p-1"), printing("p-2"), printing("p-3")],
        total: 7,
      }),
      listFaceRecords: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    },
    printingDesk: { listDeskPrintings: vi.fn().mockResolvedValue([{ printingId: "promo" }]) },
    adminEvents: { printingIdsCreatedBy: vi.fn().mockResolvedValue(["own"]) },
  };
}

function list(
  repos: ReturnType<typeof makeRepos>,
  access: AdminAccess,
  input: Parameters<typeof listWorkspaceRecords>[1]["input"],
) {
  return listWorkspaceRecords(repos as unknown as WorkspaceRepos, {
    access,
    userId: "user-1",
    input,
  });
}

describe("listWorkspaceRecords", () => {
  it("returns a page, the next cursor and the total", async () => {
    const response = await list(makeRepos(), ADMIN, { kind: "printing", limit: 2 });
    expect(response.rows.map((row) => row.id)).toEqual(["p-1", "p-2"]);
    expect(response.nextCursor).not.toBeNull();
    expect(response.total).toBe(7);
  });

  it("passes the filter and the caller's created printings for mine", async () => {
    const repos = makeRepos();
    await list(repos, ADMIN, { kind: "printing", filter: "mine" });
    expect(repos.adminEvents.printingIdsCreatedBy).toHaveBeenCalledWith("user-1");
    expect(repos.workspaceRecords.listPrintingRecords).toHaveBeenCalledWith(
      expect.objectContaining({ filter: "mine", mineIds: ["own"], printingIds: undefined }),
    );
  });

  it("scopes a desk holder to promo and own printings", async () => {
    const repos = makeRepos();
    await list(repos, DESK, { kind: "printing", filter: "mine" });
    expect(repos.workspaceRecords.listPrintingRecords).toHaveBeenCalledWith(
      expect.objectContaining({ mineIds: ["own"], printingIds: ["promo", "own"] }),
    );
  });

  it("passes a face filter and drops one that belongs to printings", async () => {
    const repos = makeRepos();
    await list(repos, ADMIN, { kind: "face", filter: "substitute" });
    expect(repos.workspaceRecords.listFaceRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: "substitute" }),
    );
    await list(repos, ADMIN, { kind: "face", filter: "promo" });
    expect(repos.workspaceRecords.listFaceRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: undefined }),
    );
  });
});
