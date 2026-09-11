import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { deleteGroupBanner } from "../services/group-banners.js";
import { adminFriendGroupBannersRouter } from "./admin-friend-group-banners.js";

vi.mock("../services/group-banners.js", () => ({
  deleteGroupBanner: vi.fn(() => Promise.resolve()),
}));

const mockDelete = vi.mocked(deleteGroupBanner);

const GROUP_ID = "00000000-0000-4000-a000-000000000001";
const BANNER_URL = "/media/group-banners/0199251c-5f1a-7000-8000-00000000000a.webp";

const NOW = new Date("2026-09-11T10:00:00Z");

const bannerRow = {
  groupId: GROUP_ID,
  slug: "playgroup",
  name: "Tuesday Crew",
  bannerUrl: BANNER_URL,
  bannerPosition: 40,
  bannerUploadedAt: NOW,
  uploaderUserId: "user-1",
  uploaderName: "Group Admin",
  uploaderEmail: "admin@example.com",
  memberCount: 4,
};

function makeApp(overrides: Record<string, unknown> = {}) {
  const friendGroups = {
    listBanners: vi.fn(() => Promise.resolve([bannerRow])),
    clearBanner: vi.fn(() =>
      Promise.resolve({
        previous: { bannerUrl: BANNER_URL },
        updated: { bannerUrl: null },
      }),
    ),
    ...overrides,
  };

  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: "admin-1" } as never);
    c.set("io", {} as never);
    c.set("repos", { friendGroups } as never);
    await next();
  });
  registerRouterForTest(app as never, adminFriendGroupBannersRouter);
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.status as 400);
    }
    throw err;
  });

  return { app, friendGroups };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDelete.mockResolvedValue(undefined);
});

describe("admin friend-group banners", () => {
  it("lists every banner with its group and uploader", async () => {
    const { app } = makeApp();

    const res = await app.request("/api/admin/v1/friend-group-banners");

    expect(res.status).toBe(200);
    expect(await readJson(res)).toStrictEqual({
      items: [
        {
          groupId: GROUP_ID,
          groupSlug: "playgroup",
          groupName: "Tuesday Crew",
          bannerUrl: BANNER_URL,
          bannerPosition: 40,
          uploadedAt: NOW.toISOString(),
          uploaderUserId: "user-1",
          uploaderName: "Group Admin",
          uploaderEmail: "admin@example.com",
          memberCount: 4,
        },
      ],
    });
  });

  it("takes a banner down and unlinks the file", async () => {
    const { app, friendGroups } = makeApp();

    const res = await app.request(`/api/admin/v1/friend-group-banners/${GROUP_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(friendGroups.clearBanner).toHaveBeenCalledWith(GROUP_ID);
    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), BANNER_URL);
  });

  it("answers 404 for a group that no longer exists", async () => {
    const { app } = makeApp({ clearBanner: vi.fn(() => Promise.resolve(undefined)) });

    const res = await app.request(`/api/admin/v1/friend-group-banners/${GROUP_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
