import { ERROR_CODES } from "@openrift/shared/error-codes";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { deleteGroupBanner, saveGroupBanner } from "../services/group-banners.js";
import {
  friendGroupsBannerRouter,
  mountFriendGroupBannerMiddleware,
} from "./authenticated-friend-groups-banner.js";

vi.mock("../services/group-banners.js", () => ({
  saveGroupBanner: vi.fn(),
  deleteGroupBanner: vi.fn(() => Promise.resolve()),
}));

const mockSave = vi.mocked(saveGroupBanner);
const mockDelete = vi.mocked(deleteGroupBanner);

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const GROUP_ID = "00000000-0000-4000-a000-000000000001";

const NOW = new Date("2026-09-11T10:00:00Z");

const OLD_URL = "/media/group-banners/0199251c-5f1a-7000-8000-00000000000a.webp";
const NEW_URL = "/media/group-banners/0199251c-5f1a-7000-8000-00000000000b.webp";

const group = {
  id: GROUP_ID,
  slug: "playgroup",
  previousSlug: null,
  name: "Tuesday Crew",
  description: null,
  bannerUrl: null,
  bannerPosition: 50,
  bannerUploadedBy: null,
  bannerUploadedAt: null,
  code: "ABCDEFGHIJKL",
  codeRotatedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const membership = { groupId: GROUP_ID, userId: USER_ID, role: "owner" as const, joinedAt: NOW };

function makeApp(overrides: { friendGroups?: Record<string, unknown> } = {}) {
  const friendGroups = {
    getBySlugOrPrevious: vi.fn(() => Promise.resolve(group)),
    getMembership: vi.fn(() => Promise.resolve(membership)),
    setBanner: vi.fn(() =>
      Promise.resolve({
        previous: { ...group, bannerUrl: OLD_URL },
        updated: { ...group, bannerUrl: NEW_URL, bannerPosition: 50 },
      }),
    ),
    clearBanner: vi.fn(() =>
      Promise.resolve({ previous: { ...group, bannerUrl: OLD_URL }, updated: group }),
    ),
    ...overrides.friendGroups,
  };

  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: USER_ID } as never);
    c.set("io", {} as never);
    c.set("repos", { friendGroups } as never);
    await next();
  });
  registerRouterForTest(app as never, friendGroupsBannerRouter);
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.status as 400);
    }
    throw err;
  });

  return { app, friendGroups };
}

function postBanner(app: Hono<{ Variables: Variables }>, size = 64) {
  const body = new FormData();
  body.append("file", new File([new Uint8Array(size)], "banner.jpg", { type: "image/jpeg" }));
  return app.request("/api/v1/friend-groups/playgroup/banner", { method: "POST", body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDelete.mockResolvedValue(undefined);
  mockSave.mockResolvedValue({ status: "ok", url: NEW_URL });
});

describe("POST /friend-groups/{slug}/banner", () => {
  it("stores the upload, records it on the group, and answers with the group", async () => {
    const { app, friendGroups } = makeApp();

    const res = await postBanner(app);

    expect(res.status).toBe(200);
    expect(await readJson(res)).toMatchObject({ slug: "playgroup", bannerUrl: NEW_URL });
    expect(mockSave.mock.calls[0]?.[1]).toMatchObject({ userId: USER_ID });
    expect(friendGroups.setBanner).toHaveBeenCalledWith(GROUP_ID, {
      bannerUrl: NEW_URL,
      bannerPosition: 50,
      bannerUploadedBy: USER_ID,
      bannerUploadedAt: expect.any(Date),
    });
  });

  it("unlinks the banner it replaced", async () => {
    const { app } = makeApp();

    await postBanner(app);

    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), OLD_URL);
  });

  it("refuses a plain member", async () => {
    const { app, friendGroups } = makeApp({
      friendGroups: {
        getMembership: vi.fn(() => Promise.resolve({ ...membership, role: "member" as const })),
      },
    });

    const res = await postBanner(app);

    expect(res.status).toBe(403);
    expect(mockSave).not.toHaveBeenCalled();
    expect(friendGroups.setBanner).not.toHaveBeenCalled();
  });

  it("answers 404 for a group the viewer is not in", async () => {
    const { app } = makeApp({
      friendGroups: { getMembership: vi.fn(() => Promise.resolve(undefined)) },
    });

    const res = await postBanner(app);

    expect(res.status).toBe(404);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("rejects a file that is not an image", async () => {
    mockSave.mockResolvedValue({ status: "not_an_image" });
    const { app, friendGroups } = makeApp();

    const res = await postBanner(app);

    expect(res.status).toBe(400);
    expect(friendGroups.setBanner).not.toHaveBeenCalled();
  });

  it("reports the daily limit", async () => {
    mockSave.mockResolvedValue({ status: "rate_limited", limit: 30 });
    const { app } = makeApp();

    const res = await postBanner(app);

    expect(res.status).toBe(429);
    expect(await readJson(res)).toMatchObject({
      message: "You can upload up to 30 banners per day. Please try again later.",
    });
  });

  it("deletes the orphan when the group disappears mid-upload", async () => {
    const { app } = makeApp({
      friendGroups: { setBanner: vi.fn(() => Promise.resolve(undefined)) },
    });

    const res = await postBanner(app);

    expect(res.status).toBe(404);
    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), NEW_URL);
  });
});

describe("DELETE /friend-groups/{slug}/banner", () => {
  it("clears the row and unlinks the file", async () => {
    const { app, friendGroups } = makeApp();

    const res = await app.request("/api/v1/friend-groups/playgroup/banner", { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(friendGroups.clearBanner).toHaveBeenCalledWith(GROUP_ID);
    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), OLD_URL);
  });

  it("refuses a plain member", async () => {
    const { app, friendGroups } = makeApp({
      friendGroups: {
        getMembership: vi.fn(() => Promise.resolve({ ...membership, role: "member" as const })),
      },
    });

    const res = await app.request("/api/v1/friend-groups/playgroup/banner", { method: "DELETE" });

    expect(res.status).toBe(403);
    expect(friendGroups.clearBanner).not.toHaveBeenCalled();
  });
});

describe("banner body limit", () => {
  // Mounted on a bare app with no router: an over-cap request never reaches one.
  const limited = new Hono<{ Variables: Variables }>();
  mountFriendGroupBannerMiddleware(limited);
  limited.post("/api/v1/friend-groups/:slug/banner", (c) => c.json({ ok: true }));

  function upload(bytes: number) {
    return limited.request("/api/v1/friend-groups/playgroup/banner", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: Buffer.alloc(bytes),
    });
  }

  it("rejects a file over 20 MB with a 413 the oRPC client can parse", async () => {
    const res = await upload(20 * 1024 * 1024 + 1);

    expect(res.status).toBe(413);
    expect(await readJson(res)).toStrictEqual({
      defined: false,
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      status: 413,
      message: "File exceeds 20 MB",
    });
  });

  it("lets an under-cap file through", async () => {
    const res = await upload(1024);

    expect(res.status).toBe(200);
  });
});
