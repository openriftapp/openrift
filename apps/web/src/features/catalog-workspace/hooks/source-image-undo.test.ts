import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  remove: vi.fn((_input: unknown) => Promise.resolve()),
  activate: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  deletePrintingImageFn: mocks.remove,
  activatePrintingImageFn: mocks.activate,
}));

const { sourceImageUndo } = await import("./source-image-undo");

const { signal } = new AbortController();

beforeEach(() => {
  mocks.remove.mockClear();
  mocks.activate.mockClear();
});

describe("sourceImageUndo", () => {
  it("deletes the stored image and makes the replaced image main again", async () => {
    const entry = sourceImageUndo(
      { imageId: "new", replacedImageId: "old", restorable: true },
      "main",
      "OGN-001",
      [],
    );

    await entry?.undo(signal);

    expect(mocks.remove).toHaveBeenCalledWith({ data: { imageId: "new" }, signal });
    expect(mocks.activate).toHaveBeenCalledWith({
      data: { imageId: "old", active: true },
      signal,
    });
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.activate.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("only deletes an image stored beside the main one", async () => {
    const entry = sourceImageUndo(
      { imageId: "new", replacedImageId: null, restorable: true },
      "additional",
      "OGN-001",
      [],
    );

    await entry?.undo(signal);

    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it("offers no undo when the earlier state cannot be restored", () => {
    expect(
      sourceImageUndo(
        { imageId: "new", replacedImageId: null, restorable: false },
        "main",
        "OGN-001",
        [],
      ),
    ).toBeNull();
    expect(
      sourceImageUndo(
        { imageId: null, replacedImageId: null, restorable: true },
        "main",
        "OGN-001",
        [],
      ),
    ).toBeNull();
  });
});
