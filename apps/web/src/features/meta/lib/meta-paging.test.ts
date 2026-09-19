import { describe, expect, it } from "vitest";

import {
  META_MAX_PAGE_SIZE,
  META_PAGE_ALL,
  metaPageCount,
  metaPageSize,
  metaPageSlice,
  metaPagingSearchFields,
  metaPagingSearchFieldsWithAll,
} from "./meta-paging";

describe("metaPageSize", () => {
  it("falls back to the surface's own size when the link names none", () => {
    expect(metaPageSize(undefined, 50, 800)).toBe(50);
  });

  it("takes the size the link names", () => {
    expect(metaPageSize(200, 50, 800)).toBe(200);
  });

  it("gives a reader who asked for everything the whole list", () => {
    expect(metaPageSize(META_PAGE_ALL, 50, 800)).toBe(800);
  });

  it("caps the whole list, however long it runs", () => {
    expect(metaPageSize(META_PAGE_ALL, 50, 99_000)).toBe(META_MAX_PAGE_SIZE);
  });

  it("never asks for a page of nothing, so an empty list still makes one request", () => {
    expect(metaPageSize(META_PAGE_ALL, 50, 0)).toBe(1);
  });
});

describe("metaPageSlice", () => {
  it("opens on the first page when the link names none", () => {
    expect(metaPageSlice(undefined, 50)).toEqual({ limit: 50, offset: 0 });
  });

  it("counts the offset from the page before it", () => {
    expect(metaPageSlice(3, 50)).toEqual({ limit: 50, offset: 100 });
  });

  it("stops the offset where the contract does, so a page past that asks for a legal slice", () => {
    expect(metaPageSlice(30_000, 50)).toEqual({ limit: 50, offset: 1_000_000 });
    expect(metaPageSlice(1_000_000, 500)).toEqual({ limit: 500, offset: 1_000_000 });
  });
});

describe("metaPageCount", () => {
  it("keeps one page for an empty list, so the pager has something to render against", () => {
    expect(metaPageCount(0, 50)).toBe(1);
  });

  it("rounds a partial last page up", () => {
    expect(metaPageCount(51, 50)).toBe(2);
    expect(metaPageCount(100, 50)).toBe(2);
  });
});

describe("metaPagingSearchFields", () => {
  const fields = metaPagingSearchFields();

  it("drops a page no arithmetic on it would survive", () => {
    expect(fields.page.parse(2_000_000)).toBeUndefined();
    expect(fields.page.parse(1e30)).toBeUndefined();
    expect(fields.page.parse(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it("drops a page that is not a positive whole number", () => {
    expect(fields.page.parse(0)).toBeUndefined();
    expect(fields.page.parse(-3)).toBeUndefined();
    expect(fields.page.parse(1.5)).toBeUndefined();
    expect(fields.page.parse("later")).toBeUndefined();
  });

  it("keeps a page a link could legitimately carry", () => {
    expect(fields.page.parse(12)).toBe(12);
  });

  it("drops a size past the largest the pickers offer", () => {
    expect(fields.per.parse(501)).toBeUndefined();
    expect(fields.per.parse(500)).toBe(500);
  });

  it("drops a size no picker offers, which would leave its trigger blank", () => {
    expect(fields.per.parse(7)).toBeUndefined();
    expect(fields.per.parse(250)).toBeUndefined();
    expect(fields.per.parse("100")).toBe(100);
  });
});

describe("metaPagingSearchFieldsWithAll", () => {
  const fields = metaPagingSearchFieldsWithAll();

  it("takes the whole list by name", () => {
    expect(fields.per.parse(META_PAGE_ALL)).toBe(META_PAGE_ALL);
  });

  it("still holds a numeric size to the ones the picker offers", () => {
    expect(fields.per.parse(200)).toBe(200);
    expect(fields.per.parse(9000)).toBeUndefined();
    expect(fields.per.parse(7)).toBeUndefined();
  });
});
