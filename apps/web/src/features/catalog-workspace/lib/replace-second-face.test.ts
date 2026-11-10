import { describe, expect, it, vi } from "vitest";

import { replaceSecondFace } from "./replace-second-face";

const ids = { printingId: "p1", oldFaceId: "old", newFaceId: "new" };

function failing() {
  return Promise.reject(new Error("refused"));
}

describe("replaceSecondFace", () => {
  it("removes the old face, then sets the new one", async () => {
    const remove = vi.fn(async () => {});
    const set = vi.fn(async () => {});

    await expect(replaceSecondFace({ remove, set, ...ids })).resolves.toBe("replaced");
    expect(remove).toHaveBeenCalledWith({ printingId: "p1", faceId: "old" });
    expect(set).toHaveBeenCalledExactlyOnceWith({ printingId: "p1", faceId: "new" });
  });

  it("sets the old face again when the new one is refused", async () => {
    const remove = vi.fn(async () => {});
    const set = vi.fn(async ({ faceId }: { faceId: string }) => {
      if (faceId === "new") {
        await failing();
      }
    });

    await expect(replaceSecondFace({ remove, set, ...ids })).resolves.toBe("restored");
    expect(set).toHaveBeenLastCalledWith({ printingId: "p1", faceId: "old" });
  });

  it("reports a lost face when putting it back fails too", async () => {
    const remove = vi.fn(async () => {});
    const set = vi.fn(failing);

    await expect(replaceSecondFace({ remove, set, ...ids })).resolves.toBe("lost");
    expect(set).toHaveBeenCalledTimes(2);
  });

  it("touches nothing else when the removal fails", async () => {
    const remove = vi.fn(failing);
    const set = vi.fn(async () => {});

    await expect(replaceSecondFace({ remove, set, ...ids })).resolves.toBe("unchanged");
    expect(set).not.toHaveBeenCalled();
  });
});
