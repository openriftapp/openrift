import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import {
  loadCollectionAccess,
  loadWritableCopies,
  requireCollectionAdmin,
} from "./collection-access.js";

function reposWith(options: {
  access?: { viewerCanAdmin: boolean };
  copies?: { id: string; printingId: string; collectionId: string; collectionName: string }[];
  writable?: string[];
}): Repos {
  return {
    collections: {
      getAccessForUser: vi.fn(() => Promise.resolve(options.access)),
      filterWritableByViewer: vi.fn(() => Promise.resolve(options.writable ?? [])),
    },
    copies: {
      listWithCollectionContext: vi.fn(() => Promise.resolve(options.copies ?? [])),
    },
  } as unknown as Repos;
}

const copy = (id: string, collectionId: string) => ({
  id,
  printingId: "p-1",
  collectionId,
  collectionName: "Binder",
});

describe("loadCollectionAccess", () => {
  it("returns the access row", async () => {
    const access = { viewerCanAdmin: false };
    await expect(loadCollectionAccess(reposWith({ access }), "c-1", "u-1")).resolves.toBe(access);
  });

  it("throws 404 when the viewer has no access", async () => {
    await expect(loadCollectionAccess(reposWith({}), "c-1", "u-1")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("requireCollectionAdmin", () => {
  it("returns the access row for an admin", async () => {
    const access = { viewerCanAdmin: true };
    await expect(
      requireCollectionAdmin(reposWith({ access }), "c-1", "u-1", "edit this collection"),
    ).resolves.toBe(access);
  });

  it("throws 403 naming the action for a non-admin", async () => {
    await expect(
      requireCollectionAdmin(
        reposWith({ access: { viewerCanAdmin: false } }),
        "c-1",
        "u-1",
        "edit this collection",
      ),
    ).rejects.toMatchObject({ status: 403, message: "Only admins can edit this collection" });
  });

  it("throws 404 before the admin check when there is no access", async () => {
    await expect(
      requireCollectionAdmin(reposWith({}), "c-1", "u-1", "edit this collection"),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("loadWritableCopies", () => {
  it("returns the copies when every source collection is writable", async () => {
    const copies = [copy("cp-1", "c-1"), copy("cp-2", "c-1")];
    const repos = reposWith({ copies, writable: ["c-1"] });
    await expect(loadWritableCopies(repos, "u-1", ["cp-1", "cp-2"])).resolves.toBe(copies);
    expect(repos.collections.filterWritableByViewer).toHaveBeenCalledWith(["c-1"], "u-1");
  });

  it("throws 404 when a copy is missing", async () => {
    const repos = reposWith({ copies: [copy("cp-1", "c-1")], writable: ["c-1"] });
    await expect(loadWritableCopies(repos, "u-1", ["cp-1", "cp-2"])).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws 403 when a source collection is not writable", async () => {
    const repos = reposWith({
      copies: [copy("cp-1", "c-1"), copy("cp-2", "c-2")],
      writable: ["c-1"],
    });
    await expect(loadWritableCopies(repos, "u-1", ["cp-1", "cp-2"])).rejects.toMatchObject({
      status: 403,
    });
  });
});
