import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultIo } from "../io.js";
import type { Io } from "../io.js";
import { mockMkdir, mockUnlink, mockWriteFile, resetImageMocks } from "../test/image-mocks.js";
import { MEDIA_DIR, createMediaUploadStore } from "./media-upload.js";

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
const encoded = { data: Buffer.from("encoded"), ext: "webp" };

type Encode = Parameters<typeof createMediaUploadStore>[0]["encode"];

function makeStore(encode: Encode = vi.fn(async () => encoded), dailyLimit = 2) {
  return createMediaUploadStore({ subdir: "test-uploads", dailyLimit, encode });
}

beforeEach(() => {
  resetImageMocks();
});

describe("createMediaUploadStore", () => {
  it("places the folder and URL prefix under media/<subdir>", () => {
    const store = makeStore();
    expect(store.dir).toBe(`${MEDIA_DIR}/test-uploads`);
    expect(store.urlPrefix).toBe("/media/test-uploads/");
  });

  it("writes the encoded image under a uuid name and returns its URL", async () => {
    const store = makeStore();
    const result = await store.save(io, { userId: "u1", buffer: Buffer.from("raw"), now: NOW });

    expect(result.status).toBe("ok");
    const url = result.status === "ok" ? result.url : "";
    expect(url).toMatch(/^\/media\/test-uploads\/[0-9a-f-]{36}\.webp$/u);
    expect(mockMkdir).toHaveBeenCalledWith(store.dir, { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledWith(`${store.dir}/${store.fileName(url)}`, encoded.data);
  });

  it("reports not_an_image when the encoder rejects the buffer", async () => {
    const store = makeStore(vi.fn(async () => null));
    const result = await store.save(io, { userId: "u1", buffer: Buffer.from("x"), now: NOW });

    expect(result).toEqual({ status: "not_an_image" });
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("rate limits per user within a day and resets after it", async () => {
    const store = makeStore();
    const args = { userId: "u1", buffer: Buffer.from("raw"), now: NOW };
    await store.save(io, args);
    await store.save(io, args);

    expect(await store.save(io, args)).toEqual({ status: "rate_limited", limit: 2 });
    const otherUser = await store.save(io, { ...args, userId: "u2" });
    expect(otherUser.status).toBe("ok");

    const nextDay = new Date(NOW.getTime() + 24 * 60 * 60 * 1000 + 1);
    const afterReset = await store.save(io, { ...args, now: nextDay });
    expect(afterReset.status).toBe("ok");
  });

  it("does not count a rejected upload against the limit", async () => {
    const encode = vi.fn<Encode>(async () => encoded);
    encode.mockResolvedValueOnce(null);
    const store = makeStore(encode, 1);
    const args = { userId: "u1", buffer: Buffer.from("raw"), now: NOW };

    expect(await store.save(io, args)).toEqual({ status: "not_an_image" });
    const retry = await store.save(io, args);
    expect(retry.status).toBe("ok");
  });

  it("removes the file behind a URL and swallows a missing file", async () => {
    const store = makeStore();
    mockUnlink.mockRejectedValueOnce(new Error("ENOENT"));

    await expect(store.remove(io, "/media/test-uploads/a.webp")).resolves.toBeUndefined();
    expect(mockUnlink).toHaveBeenCalledWith(`${store.dir}/a.webp`);
  });
});
