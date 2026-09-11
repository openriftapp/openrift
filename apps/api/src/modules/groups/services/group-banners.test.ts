import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";

import { defaultIo } from "../../../io.js";
import type { Io } from "../../../io.js";
import {
  mockMkdir,
  mockUnlink,
  mockWriteFile,
  resetImageMocks,
} from "../../../test/image-mocks.js";
import { GROUP_BANNER_MEDIA_DIR, deleteGroupBanner, saveGroupBanner } from "./group-banners.js";

const io: Io = {
  ...defaultIo,
  fs: {
    ...defaultIo.fs,
    mkdir: mockMkdir as never,
    unlink: mockUnlink as never,
    writeFile: mockWriteFile as never,
  },
};

const NOW = new Date("2026-09-11T10:00:00Z");

function picture(options: { width: number; height: number; format: "png" | "jpeg" }) {
  const image = sharp({
    create: {
      width: options.width,
      height: options.height,
      channels: 3,
      background: { r: 12, g: 90, b: 200 },
    },
  });
  return options.format === "png" ? image.png().toBuffer() : image.jpeg().toBuffer();
}

function writtenBuffer(): Buffer {
  return mockWriteFile.mock.calls[0]?.[1] as Buffer;
}

beforeEach(() => {
  resetImageMocks();
});

describe("saveGroupBanner", () => {
  it("stores a webp under a uuid name and answers with its public URL", async () => {
    const result = await saveGroupBanner(io, {
      userId: "webp-user",
      buffer: await picture({ width: 2000, height: 800, format: "jpeg" }),
      now: NOW,
    });

    expect(result).toStrictEqual({
      status: "ok",
      url: expect.stringMatching(
        /^\/media\/group-banners\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/u,
      ),
    });
    expect(mockMkdir).toHaveBeenCalledWith(GROUP_BANNER_MEDIA_DIR, { recursive: true });
    expect(String(mockWriteFile.mock.calls[0]?.[0]).startsWith(GROUP_BANNER_MEDIA_DIR)).toBe(true);
    const meta = await sharp(writtenBuffer()).metadata();
    expect(meta.format).toBe("webp");
  });

  it("caps the width at 1600px and keeps the aspect", async () => {
    await saveGroupBanner(io, {
      userId: "wide-user",
      buffer: await picture({ width: 3200, height: 1000, format: "jpeg" }),
      now: NOW,
    });

    const meta = await sharp(writtenBuffer()).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(500);
  });

  it("leaves a narrower picture at its own size", async () => {
    await saveGroupBanner(io, {
      userId: "narrow-user",
      buffer: await picture({ width: 900, height: 300, format: "png" }),
      now: NOW,
    });

    const meta = await sharp(writtenBuffer()).metadata();
    expect(meta.width).toBe(900);
    expect(meta.height).toBe(300);
  });

  it("drops the EXIF the source carried", async () => {
    const source = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .withExif({ IFD0: { Copyright: "Someone", Software: "Camera" } })
      .jpeg()
      .toBuffer();
    const sourceMeta = await sharp(source).metadata();
    expect(sourceMeta.exif).toBeDefined();

    await saveGroupBanner(io, { userId: "exif-user", buffer: source, now: NOW });

    const meta = await sharp(writtenBuffer()).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it("rejects a file sharp cannot read as an image", async () => {
    const result = await saveGroupBanner(io, {
      userId: "text-user",
      buffer: Buffer.from("not an image at all"),
      now: NOW,
    });

    expect(result).toStrictEqual({ status: "not_an_image" });
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("stops a user at the daily limit and counts each user separately", async () => {
    const buffer = await picture({ width: 200, height: 100, format: "png" });
    let last = await saveGroupBanner(io, { userId: "busy-user", buffer, now: NOW });
    for (let i = 1; i <= 30; i++) {
      last = await saveGroupBanner(io, { userId: "busy-user", buffer, now: NOW });
    }

    expect(last).toStrictEqual({ status: "rate_limited", limit: 30 });
    const other = await saveGroupBanner(io, { userId: "calm-user", buffer, now: NOW });
    expect(other.status).toBe("ok");
  });

  it("lets the window slide a day on", async () => {
    const buffer = await picture({ width: 200, height: 100, format: "png" });
    for (let i = 0; i < 30; i++) {
      await saveGroupBanner(io, { userId: "tomorrow-user", buffer, now: NOW });
    }
    expect(await saveGroupBanner(io, { userId: "tomorrow-user", buffer, now: NOW })).toStrictEqual({
      status: "rate_limited",
      limit: 30,
    });

    const nextDay = new Date(NOW.getTime() + 25 * 60 * 60 * 1000);
    const result = await saveGroupBanner(io, { userId: "tomorrow-user", buffer, now: nextDay });
    expect(result.status).toBe("ok");
  });
});

describe("deleteGroupBanner", () => {
  it("unlinks a banner upload", async () => {
    await deleteGroupBanner(io, "/media/group-banners/0199251c-5f1a-7000-8000-000000000001.webp");

    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(String(mockUnlink.mock.calls[0]?.[0]).startsWith(GROUP_BANNER_MEDIA_DIR)).toBe(true);
  });

  it("ignores a null url and anything outside the banner directory", async () => {
    await deleteGroupBanner(io, null);
    await deleteGroupBanner(io, "/media/submissions/0199251c-5f1a-7000-8000-000000000001.jpg");
    await deleteGroupBanner(io, "/media/group-banners/../../etc/passwd");

    expect(mockUnlink).not.toHaveBeenCalled();
  });
});
