import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Io } from "../../../../io.js";
import { editImageFile } from "./edit.js";
import { fetchOriginalImage } from "./original-source.js";
import { deleteRehostFiles, origFileOnDisk, processAndSave } from "./variants.js";

vi.mock("./paths.js", () => ({ CARD_MEDIA_DIR: "/media/cards" }));
vi.mock("./variants.js", () => ({
  deleteRehostFiles: vi.fn(),
  origFileOnDisk: vi.fn(),
  processAndSave: vi.fn(),
}));
vi.mock("./original-source.js", () => ({ fetchOriginalImage: vi.fn() }));
vi.mock("uuid", () => ({ v7: () => "0199aaaa-0000-7000-8000-0000000000cd" }));

const OLD_ID = "0199aaaa-0000-7000-8000-0000000000ab";
const NEW_ID = "0199aaaa-0000-7000-8000-0000000000cd";
const OLD_URL = `/media/cards/ab/${OLD_ID}`;
const NEW_URL = `/media/cards/cd/${NEW_ID}`;
const QUAD = [
  { x: 1, y: 2 },
  { x: 90, y: 2 },
  { x: 90, y: 95 },
  { x: 1, y: 95 },
] as const;

const readFile = vi.fn(async () => Buffer.from("orig"));
const io = { fs: { readFile } } as unknown as Io;
const replaceImageFile = vi.fn();
const repo = { replaceImageFile } as never;

const current = {
  imageFileId: OLD_ID,
  originalUrl: "https://example.com/scan.png",
  rotation: 0 as const,
  needsTrim: false,
  quad: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  readFile.mockResolvedValue(Buffer.from("orig"));
  vi.mocked(origFileOnDisk).mockResolvedValue(`${OLD_ID}-orig.png`);
  replaceImageFile.mockResolvedValue(true);
});

describe("editImageFile", () => {
  it("writes the edit under a new id, swaps the rows and keeps the old files", async () => {
    const events: string[] = [];
    vi.mocked(processAndSave).mockImplementation(async () => {
      events.push("write new");
    });
    replaceImageFile.mockImplementation(async () => {
      events.push("swap rows");
      return true;
    });
    vi.mocked(deleteRehostFiles).mockImplementation(async (_io, url) => {
      events.push(`delete ${url}`);
    });

    const id = await editImageFile(io, repo, current, { ...current, rotation: 90 });

    expect(id).toBe(NEW_ID);
    expect(readFile).toHaveBeenCalledWith(join("/media/cards", "ab", `${OLD_ID}-orig.png`));
    expect(processAndSave).toHaveBeenCalledWith(
      io,
      Buffer.from("orig"),
      ".png",
      join("/media/cards", "cd"),
      NEW_ID,
      90,
      false,
      null,
    );
    expect(replaceImageFile).toHaveBeenCalledWith(OLD_ID, {
      id: NEW_ID,
      rehostedUrl: NEW_URL,
      rotation: 90,
      needsTrim: false,
      quad: null,
    });
    expect(events).toEqual(["write new", "swap rows"]);
  });

  it("never writes under the old id", async () => {
    await editImageFile(io, repo, current, { ...current, needsTrim: true });

    for (const call of vi.mocked(processAndSave).mock.calls) {
      expect(call[4]).not.toBe(OLD_ID);
    }
    expect(deleteRehostFiles).not.toHaveBeenCalledWith(io, NEW_URL);
  });

  it("does nothing when the settings are unchanged", async () => {
    const id = await editImageFile(
      io,
      repo,
      { ...current, quad: [...QUAD] },
      { ...current, quad: [...QUAD] },
    );

    expect(id).toBe(OLD_ID);
    expect(processAndSave).not.toHaveBeenCalled();
    expect(replaceImageFile).not.toHaveBeenCalled();
  });

  it("fetches the source when no orig is on disk", async () => {
    vi.mocked(origFileOnDisk).mockResolvedValue(undefined);
    vi.mocked(fetchOriginalImage).mockResolvedValue({ buffer: Buffer.from("src"), ext: ".jpg" });

    await editImageFile(io, repo, current, { ...current, quad: [...QUAD] });

    expect(fetchOriginalImage).toHaveBeenCalledWith(io, current.originalUrl);
    expect(processAndSave).toHaveBeenCalledWith(
      io,
      Buffer.from("src"),
      ".jpg",
      join("/media/cards", "cd"),
      NEW_ID,
      0,
      false,
      [...QUAD],
    );
  });

  it("refuses an image with neither an orig nor a source URL", async () => {
    vi.mocked(origFileOnDisk).mockResolvedValue(undefined);

    await expect(
      editImageFile(io, repo, { ...current, originalUrl: null }, { ...current, rotation: 180 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(processAndSave).not.toHaveBeenCalled();
  });

  it("removes the new files and keeps the old ones when the pipeline rejects the edit", async () => {
    vi.mocked(processAndSave).mockRejectedValue(new Error("Quad does not fit the original image"));

    await expect(editImageFile(io, repo, current, { ...current, quad: [...QUAD] })).rejects.toThrow(
      "Quad does not fit",
    );

    expect(replaceImageFile).not.toHaveBeenCalled();
    expect(deleteRehostFiles).toHaveBeenCalledWith(io, NEW_URL);
    expect(deleteRehostFiles).not.toHaveBeenCalledWith(io, OLD_URL);
  });

  it("answers a conflict and removes the new files when a concurrent edit replaced the row", async () => {
    replaceImageFile.mockResolvedValue(false);

    await expect(
      editImageFile(io, repo, current, { ...current, rotation: 270 }),
    ).rejects.toMatchObject({ status: 409 });

    expect(deleteRehostFiles).toHaveBeenCalledWith(io, NEW_URL);
    expect(deleteRehostFiles).not.toHaveBeenCalledWith(io, OLD_URL);
  });
});
