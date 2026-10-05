import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiContext } from "../../../orpc/context.js";
import { createTagCategoryHandlers } from "./tag-category-handlers.js";

const repo = {
  listAll: vi.fn(),
  getById: vi.fn(),
  getBySlug: vi.fn(),
  getMaxSortOrder: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  isInUse: vi.fn(),
};
const listTags = vi.fn();
const context = {} as ApiContext;

const handlers = createTagCategoryHandlers({
  repo: () => repo,
  listTags,
  entityLabel: "Custom-tag category",
});

const now = new Date("2026-03-17T00:00:00.000Z");
const category = {
  id: "cat-1",
  slug: "species",
  label: "Species",
  description: null,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listCategories", () => {
  it("counts the loaded tags per category", async () => {
    repo.listAll.mockResolvedValue([category, { ...category, id: "cat-2", slug: "region" }]);
    listTags.mockResolvedValue([{ categoryId: "cat-1" }, { categoryId: "cat-1" }]);

    const { categories } = await handlers.listCategories({ context });

    expect(listTags).toHaveBeenCalledWith(context);
    expect(categories.map((cat) => [cat.id, cat.tagCount])).toEqual([
      ["cat-1", 2],
      ["cat-2", 0],
    ]);
  });
});

describe("createCategory", () => {
  it("appends after the current max sort order", async () => {
    repo.getBySlug.mockResolvedValue(undefined);
    repo.getMaxSortOrder.mockResolvedValue(4);
    repo.create.mockResolvedValue({ ...category, sortOrder: 5 });

    const result = await handlers.createCategory({
      input: { slug: "species", label: "Species" },
      context,
    });

    expect(repo.create).toHaveBeenCalledWith({
      slug: "species",
      label: "Species",
      description: undefined,
      sortOrder: 5,
    });
    expect(result.category).toMatchObject({ id: "cat-1", tagCount: 0, sortOrder: 5 });
  });

  it("rejects a taken slug", async () => {
    repo.getBySlug.mockResolvedValue(category);

    await expect(
      handlers.createCategory({ input: { slug: "species", label: "Species" }, context }),
    ).rejects.toMatchObject({ status: 409, message: 'Category "species" already exists' });
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("updateCategory", () => {
  it("uses the entity label in the not-found message", async () => {
    repo.getById.mockResolvedValue(undefined);

    await expect(
      handlers.updateCategory({ input: { id: "missing", label: "X" }, context }),
    ).rejects.toMatchObject({ status: 404, message: "Custom-tag category not found" });
  });

  it("rejects a rename onto a taken slug", async () => {
    repo.getById.mockResolvedValue(category);
    repo.getBySlug.mockResolvedValue({ ...category, id: "cat-2" });

    await expect(
      handlers.updateCategory({ input: { id: "cat-1", slug: "region" }, context }),
    ).rejects.toMatchObject({ status: 409, message: 'Slug "region" already in use' });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("passes the body without the id to the repo", async () => {
    repo.getById.mockResolvedValue(category);

    await handlers.updateCategory({ input: { id: "cat-1", label: "Kin" }, context });

    expect(repo.getBySlug).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith("cat-1", { label: "Kin" });
  });
});

describe("removeCategory", () => {
  it("returns 404 for an unknown id", async () => {
    repo.getById.mockResolvedValue(undefined);

    await expect(
      handlers.removeCategory({ input: { id: "missing" }, context }),
    ).rejects.toMatchObject({ status: 404, message: "Custom-tag category not found" });
  });

  it("refuses to delete a category that still has tags", async () => {
    repo.getById.mockResolvedValue(category);
    repo.isInUse.mockResolvedValue(true);

    await expect(
      handlers.removeCategory({ input: { id: "cat-1" }, context }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it("deletes an unused category", async () => {
    repo.getById.mockResolvedValue(category);
    repo.isInUse.mockResolvedValue(false);

    await handlers.removeCategory({ input: { id: "cat-1" }, context });

    expect(repo.deleteById).toHaveBeenCalledWith("cat-1");
  });
});
