import { describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { assertSlugFreeForRename } from "./taxonomy-assertions.js";

describe("assertSlugFreeForRename", () => {
  it("skips the lookup when no new slug is given", async () => {
    const getBySlug = vi.fn();
    await assertSlugFreeForRename(getBySlug, "top-8");
    expect(getBySlug).not.toHaveBeenCalled();
  });

  it("skips the lookup when the slug is unchanged", async () => {
    const getBySlug = vi.fn();
    await assertSlugFreeForRename(getBySlug, "top-8", "top-8");
    expect(getBySlug).not.toHaveBeenCalled();
  });

  it("passes when the new slug is free", async () => {
    const getBySlug = vi.fn().mockResolvedValue(undefined);
    await assertSlugFreeForRename(getBySlug, "top-8", "top-4");
    expect(getBySlug).toHaveBeenCalledWith("top-4");
  });

  it("throws a 409 when another row holds the new slug", async () => {
    const getBySlug = vi.fn().mockResolvedValue({ id: "other" });
    const result = assertSlugFreeForRename(getBySlug, "top-8", "champion");
    await expect(result).rejects.toBeInstanceOf(AppError);
    await expect(result).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: 'Slug "champion" already in use',
    });
  });
});
