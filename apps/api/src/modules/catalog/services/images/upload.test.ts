import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Io } from "../../../../io.js";

vi.mock("./variants.js", () => ({ processAndSave: vi.fn() }));
vi.mock("./paths.js", () => ({
  CARD_MEDIA_DIR: "/media/cards",
  imageRehostedUrl: (id: string) => `/media/cards/${id.slice(-2)}/${id}`,
}));
vi.mock("uuid", () => ({ v7: () => "0190-file-ab" }));

import { saveUploadedImage } from "./upload.js";
import { processAndSave } from "./variants.js";

const io = {} as Io;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveUploadedImage", () => {
  it("saves the file under the id it returns", async () => {
    const result = await saveUploadedImage(io, new File(["x"], "Scan.JPG"));

    expect(result).toEqual({
      imageFileId: "0190-file-ab",
      rehostedUrl: "/media/cards/ab/0190-file-ab",
    });
    expect(processAndSave).toHaveBeenCalledWith(
      io,
      expect.any(Buffer),
      ".jpg",
      "/media/cards/ab",
      "0190-file-ab",
      0,
      false,
      null,
    );
  });

  it("413s a file over the size limit without saving it", async () => {
    const file = new File(["x"], "big.png");
    Object.defineProperty(file, "size", { value: 51 * 1024 * 1024 });

    await expect(saveUploadedImage(io, file)).rejects.toMatchObject({ status: 413 });
    expect(processAndSave).not.toHaveBeenCalled();
  });
});
